"""
PON Port Poller Service
Main polling service for OLT/PON monitoring
"""

import asyncio
import asyncpg
import redis
import time
import os
from datetime import datetime
from pysnmp.hlapi import *
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from vendors.zte import ZTEVendor
from vendors.huawei import HuaweiVendor

class PONPortPoller:
    def __init__(self):
        self.db_pool = None
        self.redis_client = None
        self.influx_client = None
        self.influx_write_api = None
        
        # Configuration
        self.db_config = {
            'host': os.getenv('POSTGRES_HOST', 'localhost'),
            'port': int(os.getenv('POSTGRES_PORT', 5432)),
            'database': os.getenv('POSTGRES_DB', 'wagateway'),
            'user': os.getenv('POSTGRES_USER', 'wagateway'),
            'password': os.getenv('POSTGRES_PASSWORD', ''),
        }
        
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        
        self.influx_config = {
            'url': os.getenv('INFLUXDB_URL', 'http://localhost:8086'),
            'token': os.getenv('INFLUXDB_TOKEN', ''),
            'org': os.getenv('INFLUXDB_ORG', 'wagateway'),
            'bucket': os.getenv('INFLUXDB_BUCKET', 'pon_monitoring'),
        }
        
        self.vendor_map = {
            'ZTE': ZTEVendor,
            'Huawei': HuaweiVendor,
        }
        
        self.poll_interval = int(os.getenv('POLL_INTERVAL', 60))  # seconds
    
    async def initialize(self):
        """Initialize database connections"""
        print("Initializing PON Poller Service...")
        
        # PostgreSQL
        self.db_pool = await asyncpg.create_pool(**self.db_config, min_size=2, max_size=10)
        print(f"✓ Connected to PostgreSQL: {self.db_config['database']}")
        
        # Redis
        self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
        self.redis_client.ping()
        print(f"✓ Connected to Redis")
        
        # InfluxDB
        self.influx_client = InfluxDBClient(
            url=self.influx_config['url'],
            token=self.influx_config['token'],
            org=self.influx_config['org']
        )
        self.influx_write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
        print(f"✓ Connected to InfluxDB: {self.influx_config['bucket']}")
    
    async def poll_all_olts(self):
        """Poll all active OLTs"""
        async with self.db_pool.acquire() as conn:
            olts = await conn.fetch(
                "SELECT * FROM olts WHERE status = 'active' ORDER BY id"
            )
            
            print(f"\n=== Polling {len(olts)} OLTs ===")
            
            tasks = []
            for olt in olts:
                task = self.poll_olt(olt)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            success = sum(1 for r in results if r is True)
            failed = len(results) - success
            
            print(f"✓ Polling completed: {success} success, {failed} failed")
    
    async def poll_olt(self, olt):
        """Poll single OLT"""
        olt_id = olt['id']
        olt_name = olt['name']
        
        try:
            print(f"  Polling OLT: {olt_name} ({olt['ip_address']})")
            
            # Get vendor handler
            vendor_class = self.vendor_map.get(olt['vendor'])
            if not vendor_class:
                print(f"  ✗ Unsupported vendor: {olt['vendor']}")
                return False
            
            # Get PON ports
            async with self.db_pool.acquire() as conn:
                pon_ports = await conn.fetch(
                    "SELECT * FROM pon_ports WHERE olt_id = $1 AND status = 'active'",
                    olt_id
                )
            
            # Poll each PON port
            for pon_port in pon_ports:
                await self.poll_pon_port(olt, pon_port, vendor_class)
            
            # Update OLT last poll
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE olts SET last_poll = NOW() WHERE id = $1",
                    olt_id
                )
            
            return True
            
        except Exception as e:
            print(f"  ✗ Error polling OLT {olt_name}: {str(e)}")
            return False
    
    async def poll_pon_port(self, olt, pon_port, vendor_class):
        """Poll single PON port"""
        port_name = pon_port['port_name']
        
        try:
            # SNMP Get for PON port metrics
            metrics = await self.snmp_get_pon_metrics(
                olt['ip_address'],
                olt['snmp_community'],
                pon_port['port_number'],
                vendor_class
            )
            
            if not metrics:
                return
            
            # Calculate health score
            health_score = self.calculate_health_score(metrics)
            
            # Update PostgreSQL (latest values)
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE pon_ports SET
                        temperature = $1,
                        voltage = $2,
                        tx_power = $3,
                        rx_power = $4,
                        utilization = $5,
                        bandwidth_in = $6,
                        bandwidth_out = $7,
                        online_onus = $8,
                        offline_onus = $9,
                        total_onus = $10,
                        health_score = $11,
                        last_poll = NOW()
                    WHERE id = $12
                """,
                    metrics.get('temperature'),
                    metrics.get('voltage'),
                    metrics.get('tx_power'),
                    metrics.get('rx_power'),
                    metrics.get('utilization'),
                    metrics.get('bandwidth_in'),
                    metrics.get('bandwidth_out'),
                    metrics.get('online_onus', 0),
                    metrics.get('offline_onus', 0),
                    metrics.get('total_onus', 0),
                    health_score,
                    pon_port['id']
                )
            
            # Write to InfluxDB (time-series)
            point = Point("pon_port_metrics") \
                .tag("pon_port_id", str(pon_port['id'])) \
                .tag("olt_id", str(olt['id'])) \
                .tag("port_name", port_name) \
                .field("temperature", float(metrics.get('temperature') or 0)) \
                .field("voltage", float(metrics.get('voltage') or 0)) \
                .field("tx_power", float(metrics.get('tx_power') or 0)) \
                .field("rx_power", float(metrics.get('rx_power') or 0)) \
                .field("utilization", float(metrics.get('utilization') or 0)) \
                .field("bandwidth_in", int(metrics.get('bandwidth_in') or 0)) \
                .field("bandwidth_out", int(metrics.get('bandwidth_out') or 0)) \
                .field("online_onus", int(metrics.get('online_onus') or 0)) \
                .field("health_score", int(health_score)) \
                .time(datetime.utcnow())
            
            self.influx_write_api.write(
                bucket=self.influx_config['bucket'],
                record=point
            )
            
            # Cache to Redis (real-time dashboard)
            cache_key = f"pon_port:{pon_port['id']}:metrics"
            self.redis_client.hset(cache_key, mapping={
                'temperature': str(metrics.get('temperature') or 0),
                'voltage': str(metrics.get('voltage') or 0),
                'tx_power': str(metrics.get('tx_power') or 0),
                'rx_power': str(metrics.get('rx_power') or 0),
                'utilization': str(metrics.get('utilization') or 0),
                'online_onus': str(metrics.get('online_onus') or 0),
                'health_score': str(health_score),
                'timestamp': datetime.utcnow().isoformat(),
            })
            self.redis_client.expire(cache_key, 300)  # 5 minutes
            
            # Check thresholds
            await self.check_thresholds(pon_port, metrics)
            
            print(f"    ✓ {port_name}: Health={health_score}%, Util={metrics.get('utilization', 0):.1f}%")
            
        except Exception as e:
            print(f"    ✗ Error polling {port_name}: {str(e)}")
    
    async def snmp_get_pon_metrics(self, ip, community, port_number, vendor_class):
        """Get PON port metrics via SNMP"""
        try:
            metrics = {}
            
            # Build OID index (vendor specific)
            oid_index = port_number
            
            # Get all metrics
            for metric_name, base_oid in vendor_class.PON_PORT_OIDS.items():
                oid = f"{base_oid}.{oid_index}"
                
                errorIndication, errorStatus, errorIndex, varBinds = next(
                    getCmd(SnmpEngine(),
                           CommunityData(community),
                           UdpTransportTarget((ip, 161), timeout=5, retries=1),
                           ContextData(),
                           ObjectType(ObjectIdentity(oid)))
                )
                
                if errorIndication or errorStatus:
                    continue
                
                for varBind in varBinds:
                    value = varBind[1]
                    if hasattr(value, '_value'):
                        value = value._value
                    
                    # Parse based on metric type
                    if metric_name in ['temperature']:
                        metrics[metric_name] = vendor_class.parse_temperature(value)
                    elif metric_name in ['voltage']:
                        metrics[metric_name] = vendor_class.parse_voltage(value)
                    elif metric_name in ['tx_power', 'rx_power']:
                        metrics[metric_name] = vendor_class.parse_power(value)
                    else:
                        metrics[metric_name] = int(value) if value else 0
            
            # Calculate utilization
            if 'bandwidth_in' in metrics and 'bandwidth_out' in metrics:
                metrics['utilization'] = vendor_class.calculate_utilization(
                    metrics['bandwidth_in'],
                    metrics['bandwidth_out']
                )
            
            # Mock ONU counts (in production, walk ONU table)
            metrics['online_onus'] = 0
            metrics['offline_onus'] = 0
            metrics['total_onus'] = 0
            
            return metrics
            
        except Exception as e:
            print(f"      SNMP Error: {str(e)}")
            return None
    
    def calculate_health_score(self, metrics):
        """Calculate PON port health score (0-100)"""
        score = 100
        
        # Utilization (30%)
        utilization = metrics.get('utilization', 0)
        if utilization > 90:
            score -= 30
        elif utilization > 80:
            score -= 20
        elif utilization > 70:
            score -= 10
        
        # Temperature (20%)
        temperature = metrics.get('temperature')
        if temperature:
            if temperature > 70:
                score -= 20
            elif temperature > 60:
                score -= 10
        
        # RX Power (30%)
        rx_power = metrics.get('rx_power')
        if rx_power:
            if rx_power < -30:
                score -= 30
            elif rx_power < -28:
                score -= 15
        
        # Offline ONUs (20%)
        total_onus = metrics.get('total_onus', 0)
        offline_onus = metrics.get('offline_onus', 0)
        if total_onus > 0:
            offline_ratio = offline_onus / total_onus
            if offline_ratio > 0.3:
                score -= 20
            elif offline_ratio > 0.2:
                score -= 10
        
        return max(0, score)
    
    async def check_thresholds(self, pon_port, metrics):
        """Check if metrics exceed thresholds"""
        alerts = []
        
        # Temperature
        if metrics.get('temperature', 0) > pon_port['threshold_temperature_high']:
            alerts.append({
                'type': 'temperature',
                'message': f"Temperature high: {metrics['temperature']:.1f}°C",
                'value': metrics['temperature'],
            })
        
        # Utilization
        if metrics.get('utilization', 0) > pon_port['threshold_utilization_high']:
            alerts.append({
                'type': 'utilization',
                'message': f"Utilization high: {metrics['utilization']:.1f}%",
                'value': metrics['utilization'],
            })
        
        # RX Power
        if metrics.get('rx_power') and metrics['rx_power'] < pon_port['threshold_rx_power_low']:
            alerts.append({
                'type': 'rx_power',
                'message': f"RX Power low: {metrics['rx_power']:.1f} dBm",
                'value': metrics['rx_power'],
            })
        
        # Send alerts (would call notification service via API)
        for alert in alerts:
            print(f"      ⚠️  ALERT: {alert['message']}")
    
    async def run(self):
        """Main polling loop"""
        await self.initialize()
        
        print(f"\n🚀 PON Poller started! Polling every {self.poll_interval}s\n")
        
        while True:
            try:
                start_time = time.time()
                
                await self.poll_all_olts()
                
                duration = time.time() - start_time
                print(f"Poll cycle completed in {duration:.2f}s\n")
                
                # Wait for next interval
                await asyncio.sleep(max(1, self.poll_interval - duration))
                
            except KeyboardInterrupt:
                print("\n\n🛑 Shutting down...")
                break
            except Exception as e:
                print(f"❌ Error in main loop: {str(e)}")
                await asyncio.sleep(10)
        
        # Cleanup
        if self.db_pool:
            await self.db_pool.close()
        if self.influx_client:
            self.influx_client.close()
        
        print("✓ PON Poller stopped")

if __name__ == '__main__':
    poller = PONPortPoller()
    asyncio.run(poller.run())
