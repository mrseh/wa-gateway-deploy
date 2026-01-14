#!/usr/bin/env python3
"""
PON Port Polling Service
Monitors PON ports and ONUs via SNMP
"""

import os
import sys
import time
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PONPortPoller:
    """PON Port Polling Service"""
    
    def __init__(self):
        self.db_conn = None
        self.redis_client = None
        self.influx_client = None
        self.write_api = None
        self._setup_connections()
    
    def _setup_connections(self):
        """Setup database connections"""
        try:
            # PostgreSQL
            self.db_conn = psycopg2.connect(
                os.getenv('DATABASE_URL'),
                cursor_factory=RealDictCursor
            )
            logger.info("✓ PostgreSQL connected")
            
            # Redis
            self.redis_client = redis.from_url(os.getenv('REDIS_URL'))
            logger.info("✓ Redis connected")
            
            # InfluxDB
            self.influx_client = InfluxDBClient(
                url=os.getenv('INFLUXDB_URL'),
                token=os.getenv('INFLUXDB_TOKEN'),
                org=os.getenv('INFLUXDB_ORG')
            )
            self.write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
            logger.info("✓ InfluxDB connected")
            
        except Exception as e:
            logger.error(f"Connection error: {e}")
            sys.exit(1)
    
    async def poll_loop(self):
        """Main polling loop"""
        logger.info("🚀 PON Port Poller started")
        
        while True:
            try:
                # Get all OLTs with monitoring enabled
                olts = self._get_monitoring_olts()
                logger.info(f"Polling {len(olts)} OLTs")
                
                # Poll each OLT
                for olt in olts:
                    try:
                        await self._poll_olt(olt)
                    except Exception as e:
                        logger.error(f"Error polling OLT {olt['name']}: {e}")
                
                # Wait before next poll
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Polling loop error: {e}")
                await asyncio.sleep(5)
    
    def _get_monitoring_olts(self) -> List[Dict]:
        """Get OLTs with monitoring enabled"""
        cursor = self.db_conn.cursor()
        cursor.execute("""
            SELECT id, name, vendor, ip_address, snmp_community
            FROM olts
            WHERE monitoring_enabled = TRUE
            AND status = 'active'
        """)
        return cursor.fetchall()
    
    async def _poll_olt(self, olt: Dict):
        """Poll single OLT"""
        # For demonstration - simplified polling
        logger.info(f"Polling OLT: {olt['name']} ({olt['ip_address']})")
        
        # Here you would implement actual SNMP polling
        # For now, just log
        cursor = self.db_conn.cursor()
        cursor.execute("""
            UPDATE olts
            SET last_poll_at = NOW()
            WHERE id = %s
        """, (olt['id'],))
        self.db_conn.commit()
    
    def close(self):
        """Close all connections"""
        if self.db_conn:
            self.db_conn.close()
        if self.redis_client:
            self.redis_client.close()
        if self.influx_client:
            self.influx_client.close()


async def main():
    """Main entry point"""
    poller = PONPortPoller()
    
    try:
        await poller.poll_loop()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        poller.close()


if __name__ == '__main__':
    asyncio.run(main())
