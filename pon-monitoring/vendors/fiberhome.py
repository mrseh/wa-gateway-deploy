"""
FiberHome OLT OID Mappings and Parser
Support for FiberHome AN5516 series
"""

class FiberHomeVendor:
    """FiberHome specific OID mappings and data parsers"""
    
    VENDOR_NAME = "FiberHome"
    
    # OID Mappings for FiberHome
    OIDS = {
        # PON Port Status
        'pon_status': '1.3.6.1.4.1.5875.800.2.5.1.1.8',
        'pon_temperature': '1.3.6.1.4.1.5875.800.2.5.1.1.9',
        'pon_voltage': '1.3.6.1.4.1.5875.800.2.5.1.1.10',
        'pon_tx_power': '1.3.6.1.4.1.5875.800.2.5.1.1.11',
        'pon_rx_power': '1.3.6.1.4.1.5875.800.2.5.1.1.12',
        
        # PON Port Traffic
        'pon_traffic_in': '1.3.6.1.4.1.5875.800.2.5.1.1.15',
        'pon_traffic_out': '1.3.6.1.4.1.5875.800.2.5.1.1.16',
        
        # ONU Information
        'onu_index': '1.3.6.1.4.1.5875.800.2.10.1.1.1',
        'onu_name': '1.3.6.1.4.1.5875.800.2.10.1.1.2',
        'onu_status': '1.3.6.1.4.1.5875.800.2.10.1.1.3',
        'onu_rx_power': '1.3.6.1.4.1.5875.800.2.10.1.1.8',
        'onu_tx_power': '1.3.6.1.4.1.5875.800.2.10.1.1.9',
        'onu_distance': '1.3.6.1.4.1.5875.800.2.10.1.1.10',
        
        # System Information
        'system_name': '1.3.6.1.4.1.5875.800.1.1.1.0',
        'system_location': '1.3.6.1.4.1.5875.800.1.1.2.0',
        'system_uptime': '1.3.6.1.2.1.1.3.0',
    }
    
    @staticmethod
    def parse_pon_status(raw_value):
        """
        Parse PON port status
        Args:
            raw_value: Raw SNMP value
        Returns:
            str: Status description
        """
        status_map = {
            1: 'up',
            2: 'down',
            3: 'testing',
            4: 'unknown',
            5: 'dormant',
            6: 'notPresent',
            7: 'lowerLayerDown'
        }
        return status_map.get(int(raw_value), 'unknown')
    
    @staticmethod
    def parse_temperature(raw_value):
        """
        Parse temperature value
        Args:
            raw_value: Raw SNMP value (in 0.01 degree Celsius)
        Returns:
            float: Temperature in Celsius
        """
        try:
            return float(raw_value) / 100.0
        except (ValueError, TypeError):
            return 0.0
    
    @staticmethod
    def parse_voltage(raw_value):
        """
        Parse voltage value
        Args:
            raw_value: Raw SNMP value (in 0.001 V)
        Returns:
            float: Voltage in Volts
        """
        try:
            return float(raw_value) / 1000.0
        except (ValueError, TypeError):
            return 0.0
    
    @staticmethod
    def parse_power(raw_value):
        """
        Parse optical power value
        Args:
            raw_value: Raw SNMP value (in 0.01 dBm)
        Returns:
            float: Power in dBm
        """
        try:
            value = float(raw_value) / 100.0
            # FiberHome specific: handle special values
            if value > 50 or value < -50:
                return None
            return value
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def parse_traffic(raw_value):
        """
        Parse traffic counter
        Args:
            raw_value: Raw SNMP value (in bytes)
        Returns:
            int: Traffic in bytes
        """
        try:
            return int(raw_value)
        except (ValueError, TypeError):
            return 0
    
    @staticmethod
    def parse_onu_status(raw_value):
        """
        Parse ONU status
        Args:
            raw_value: Raw SNMP value
        Returns:
            str: Status description
        """
        status_map = {
            1: 'online',
            2: 'offline',
            3: 'dyingGasp',
            4: 'authFailed',
            5: 'configuring'
        }
        return status_map.get(int(raw_value), 'unknown')
    
    @staticmethod
    def parse_distance(raw_value):
        """
        Parse ONU distance
        Args:
            raw_value: Raw SNMP value (in meters)
        Returns:
            int: Distance in meters
        """
        try:
            return int(raw_value)
        except (ValueError, TypeError):
            return 0
    
    @staticmethod
    def calculate_utilization(traffic_in, traffic_out, interval, max_bandwidth):
        """
        Calculate PON port utilization percentage
        Args:
            traffic_in: Traffic in bytes
            traffic_out: Traffic out bytes
            interval: Time interval in seconds
            max_bandwidth: Maximum bandwidth in Mbps (usually 2500 for GPON)
        Returns:
            float: Utilization percentage (0-100)
        """
        if interval <= 0 or max_bandwidth <= 0:
            return 0.0
        
        # Convert bytes to bits
        total_bits = (traffic_in + traffic_out) * 8
        
        # Convert to Mbps
        current_mbps = (total_bits / interval) / 1_000_000
        
        # Calculate percentage
        utilization = (current_mbps / max_bandwidth) * 100
        
        return min(max(utilization, 0.0), 100.0)
    
    @classmethod
    def get_oid(cls, key):
        """
        Get OID for a specific metric
        Args:
            key: Metric key
        Returns:
            str: OID string or None
        """
        return cls.OIDS.get(key)
    
    @classmethod
    def get_all_oids(cls):
        """
        Get all OIDs for this vendor
        Returns:
            dict: All OID mappings
        """
        return cls.OIDS.copy()
