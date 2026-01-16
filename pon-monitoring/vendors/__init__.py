"""
PON Monitoring Vendor Implementations
Support for multiple OLT vendors
"""

from .zte import ZTEVendor
from .huawei import HuaweiVendor
from .fiberhome import FiberHomeVendor
from .vsol import VSOLVendor

# Vendor registry
VENDORS = {
    'ZTE': ZTEVendor,
    'HUAWEI': HuaweiVendor,
    'FIBERHOME': FiberHomeVendor,
    'VSOL': VSOLVendor
}

def get_vendor(vendor_name):
    """
    Get vendor implementation by name
    Args:
        vendor_name: Name of the vendor (case-insensitive)
    Returns:
        Vendor class or None if not found
    """
    return VENDORS.get(vendor_name.upper())

def get_supported_vendors():
    """
    Get list of supported vendors
    Returns:
        list: List of supported vendor names
    """
    return list(VENDORS.keys())

__all__ = [
    'ZTEVendor',
    'HuaweiVendor',
    'FiberHomeVendor',
    'VSOLVendor',
    'VENDORS',
    'get_vendor',
    'get_supported_vendors'
]
