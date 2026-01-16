"""
VSOL OLT OID Mappings and Parser
Support for VSOL V-SOL V1600 series
"""

class VSOLVendor:
    """VSOL specific OID mappings and data parsers"""
    
    VENDOR_NAME = "VSOL"
    
    # OID Mappings for VSOL
    OIDS = {
        # PON Port Information
        'pon_status': '1.3.6.1.4.1.37950.1.1.5.12.1.25.1.9',
        'pon_temperature': '1.3.6.1.4.1.37950.1.1.5.12.1.25.1.17',
        'pon_voltage': '1.3.6.1.4.1.37950.1.1.5.12.1.25.1.18',
        'pon_tx_bias': '1.3.6.1.4.1.37950.1.1.5.12.1.25.1.19',
        'pon_tx_power': '1.3.6.1.4.1.37950.1.1.5.12.1.25.1.20',
        'pon_rx_power': '1.3.6.1.4.1.37950.1.1.5.12.1.25.1.21',
        
        # PON Port Statistics
        'pon_bytes_received': '1.3.6.1.4.1.37950.1.1.5.12.2.1.1.2',
        'pon_bytes_sent': '1.3.6.1.4.1.37950.1.1.5.12.2.1.1.3',
        'pon_packets_received': '1.3.6.1.4.1.37950.1.1.5.12.2.1.1.4',
        'pon_packets_sent': '1.3.6.1.4.1.37950.1.1.5.12.2.1.1.5',
        'pon_errors': '1.3.6.1.4.1.37950.1.1.5.12.2.1.1.8',
        
        # ONU Information
        'onu_id': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.1',
        'onu_type': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.2',
        'onu_status': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.6',
        'onu_description': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.8',
        'onu_rx_power': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.15',
        'onu_tx_power': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.16',
        'onu_temperature': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.17',
        'onu_voltage': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.18',
        'onu_distance': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.19',
        'onu_mac_address': '1.3.6.1.4.1.37950.1.1.5.12.1.2.1.3',
        
        # System Information
        'system_description': '1.3.6.1.2.1.1.1.0',
        'system_uptime': '1.3.6.1.2.1.1.3.0',
        'system_name': '1.3.6.1.2.1.1.5.0',
        'system_location': '1.3.6.1.2.1.1.6.0',
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
            3: 'testing'
        }
        try:
            return status_map.get(int(raw_value), 'unknown')
        except (ValueError, TypeError):
            return 'unknown'
    
    @staticmethod
    def parse_temperature(raw_value):
        """
        Parse temperature value
        Args:
            raw_value: Raw SNMP value (in 0.001 degree Celsius)
        Returns:
            float: Temperature in Celsius
        """
        try:
            return float(raw_value) / 1000.0
        except (ValueError, TypeError):
            return 0.0
    
    @staticmethod
    def parse_voltage(raw_value):
        """
        Parse voltage value
        Args:
            raw_value: Raw SNMP value (in mV)
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
            # VSOL specific: check for invalid values
            if value == 0 or value < -40 or value > 10:
                return None
            return round(value, 2)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def parse_bias_current(raw_value):
        """
        Parse TX bias current
        Args:
            raw_value: Raw SNMP value (in uA)
        Returns:
            float: Bias current in mA
        """
        try:
            return float(raw_value) / 1000.0
        except (ValueError, TypeError):
            return 0.0
    
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
            3: 'logging',
            4: 'authFailed',
            5: 'los'  # Loss of Signal
        }
        try:
            return status_map.get(int(raw_value), 'unknown')
        except (ValueError, TypeError):
            return 'unknown'
    
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
    def parse_mac_address(raw_value):
        """
        Parse MAC address
        Args:
            raw_value: Raw SNMP value (bytes)
        Returns:
            str: MAC address in XX:XX:XX:XX:XX:XX format
        """
        if not raw_value:
            return None
        
        try:
            if isinstance(raw_value, bytes):
                mac_bytes = raw_value
            else:
                # Convert hex string to bytes
                mac_bytes = bytes.fromhex(str(raw_value).replace(':', '').replace(' ', ''))
            
            return ':'.join(f'{b:02x}' for b in mac_bytes)
        except Exception:
            return None
    
    @staticmethod
    def calculate_ber(errors, packets):
        """
        Calculate Bit Error Rate
        Args:
            errors: Number of errors
            packets: Number of packets
        Returns:
            float: BER value
        """
        if packets == 0:
            return 0.0
        
        try:
            ber = float(errors) / float(packets)
            return min(ber, 1.0)
        except (ValueError, TypeError, ZeroDivisionError):
            return 0.0
    
    @staticmethod
    def calculate_utilization(bytes_in, bytes_out, interval, max_bandwidth=2500):
        """
        Calculate PON port utilization percentage
        Args:
            bytes_in: Bytes received
            bytes_out: Bytes sent
            interval: Time interval in seconds
            max_bandwidth: Maximum bandwidth in Mbps (default 2500 for GPON)
        Returns:
            float: Utilization percentage (0-100)
        """
        if interval <= 0 or max_bandwidth <= 0:
            return 0.0
        
        # Total bytes
        total_bytes = bytes_in + bytes_out
        
        # Convert to bits per second
        bps = (total_bytes * 8) / interval
        
        # Convert to Mbps
        mbps = bps / 1_000_000
        
        # Calculate percentage
        utilization = (mbps / max_bandwidth) * 100
        
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
    
    @classmethod
    def validate_onu_data(cls, data):
        """
        Validate ONU data before storing
        Args:
            data: Dictionary of ONU metrics
        Returns:
            bool: True if valid, False otherwise
        """
        required_fields = ['onu_id', 'onu_status']
        
        for field in required_fields:
            if field not in data or data[field] is None:
                return False
        
        # Check power values are within reasonable range
        if 'onu_rx_power' in data and data['onu_rx_power'] is not None:
            if data['onu_rx_power'] < -40 or data['onu_rx_power'] > 10:
                return False
        
        return True
