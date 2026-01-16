"""
ZTE OLT OID Mappings
"""

class ZTEVendor:
    NAME = 'ZTE'
    
    # PON Port OIDs
    PON_PORT_OIDS = {
        'temperature': '1.3.6.1.4.1.3902.1082.500.10.2.3.1.1.2',
        'voltage': '1.3.6.1.4.1.3902.1082.500.10.2.3.1.1.3',
        'tx_power': '1.3.6.1.4.1.3902.1082.500.10.2.3.1.1.4',
        'rx_power': '1.3.6.1.4.1.3902.1082.500.10.2.3.1.1.5',
        'tx_bias': '1.3.6.1.4.1.3902.1082.500.10.2.3.1.1.6',
        'bandwidth_in': '1.3.6.1.2.1.2.2.1.10',
        'bandwidth_out': '1.3.6.1.2.1.2.2.1.16',
    }
    
    # ONU OIDs
    ONU_OIDS = {
        'serial_number': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.1',
        'status': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.2',
        'rx_power': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.5',
        'tx_power': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.6',
        'distance': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.7',
        'temperature': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.8',
        'voltage': '1.3.6.1.4.1.3902.1082.500.10.2.50.1.1.9',
    }
    
    @staticmethod
    def parse_power(value):
        """Convert raw power value to dBm"""
        if value is None or value == 0:
            return None
        try:
            return float(value) / 100.0
        except:
            return None
    
    @staticmethod
    def parse_temperature(value):
        """Convert raw temperature value to Celsius"""
        if value is None:
            return None
        try:
            return float(value) / 256.0
        except:
            return None
    
    @staticmethod
    def parse_voltage(value):
        """Convert raw voltage value to Volts"""
        if value is None:
            return None
        try:
            return float(value) / 10000.0
        except:
            return None
    
    @staticmethod
    def parse_onu_status(value):
        """Parse ONU status"""
        status_map = {
            1: 'online',
            2: 'offline',
            3: 'los',
            4: 'dying_gasp',
        }
        return status_map.get(value, 'unknown')
    
    @staticmethod
    def calculate_utilization(bandwidth_in, bandwidth_out, port_capacity=10000000000):
        """Calculate port utilization percentage"""
        if bandwidth_in is None or bandwidth_out is None:
            return 0.0
        
        total_bandwidth = bandwidth_in + bandwidth_out
        utilization = (total_bandwidth / port_capacity) * 100
        return min(100.0, utilization)
