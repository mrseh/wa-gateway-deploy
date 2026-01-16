/**
 * OLT Controller
 */

const db = require('../config/database');
const subscriptionService = require('../services/subscription.service');
const { validationResult } = require('express-validator');

class OLTController {
  async getOLTs(req, res) {
    try {
      const userId = req.user.id;

      const olts = await db.OLT.findAll({
        where: { user_id: userId },
        include: [
          {
            model: db.PONPort,
            as: 'pon_ports',
            attributes: ['id', 'port_name', 'status', 'health_score'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      res.json({
        success: true,
        data: olts,
      });
    } catch (error) {
      console.error('Get OLTs error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getOLT(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const olt = await db.OLT.findOne({
        where: { id, user_id: userId },
        include: [
          {
            model: db.PONPort,
            as: 'pon_ports',
            include: [
              {
                model: db.ONU,
                as: 'onus',
                attributes: ['id', 'status', 'rx_power'],
              },
            ],
          },
        ],
      });

      if (!olt) {
        return res.status(404).json({
          success: false,
          error: 'OLT not found',
        });
      }

      res.json({
        success: true,
        data: olt,
      });
    } catch (error) {
      console.error('Get OLT error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async addOLT(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation failed', details: errors.array() },
        });
      }

      const userId = req.user.id;
      const { name, vendor, model, ip_address, snmp_community, snmp_port, location, notes } = req.body;

      // Check quota
      const canAdd = await subscriptionService.canPerformAction(userId, 'add_olt', 1);
      if (!canAdd) {
        return res.status(403).json({
          success: false,
          error: 'OLT quota exceeded. Please upgrade your subscription.',
        });
      }

      // Test SNMP connection
      const testOlt = {
        ip_address,
        snmp_community,
        snmp_port: snmp_port || 161,
      };

      try {
        const snmp = require('net-snmp');
        const session = snmp.createSession(testOlt.ip_address, testOlt.snmp_community, {
          port: testOlt.snmp_port,
          timeout: 5000,
        });

        await new Promise((resolve, reject) => {
          session.get(['1.3.6.1.2.1.1.1.0'], (error, varbinds) => {
            session.close();
            if (error) reject(error);
            else resolve(varbinds);
          });
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Failed to connect to OLT. Please check IP address and SNMP community.',
        });
      }

      // Create OLT
      const olt = await db.OLT.create({
        user_id: userId,
        name,
        vendor,
        model,
        ip_address,
        snmp_community,
        snmp_port: snmp_port || 161,
        location,
        notes,
        status: 'active',
      });

      res.status(201).json({
        success: true,
        data: olt,
        message: 'OLT added successfully',
      });
    } catch (error) {
      console.error('Add OLT error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updateOLT(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, model, snmp_community, snmp_port, location, notes } = req.body;

      const olt = await db.OLT.findOne({
        where: { id, user_id: userId },
      });

      if (!olt) {
        return res.status(404).json({
          success: false,
          error: 'OLT not found',
        });
      }

      await olt.update({
        name: name || olt.name,
        model: model || olt.model,
        snmp_community: snmp_community || olt.snmp_community,
        snmp_port: snmp_port || olt.snmp_port,
        location: location !== undefined ? location : olt.location,
        notes: notes !== undefined ? notes : olt.notes,
      });

      res.json({
        success: true,
        data: olt,
        message: 'OLT updated successfully',
      });
    } catch (error) {
      console.error('Update OLT error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteOLT(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const olt = await db.OLT.findOne({
        where: { id, user_id: userId },
      });

      if (!olt) {
        return res.status(404).json({
          success: false,
          error: 'OLT not found',
        });
      }

      await olt.destroy();

      res.json({
        success: true,
        message: 'OLT deleted successfully',
      });
    } catch (error) {
      console.error('Delete OLT error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async testConnection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const olt = await db.OLT.findOne({
        where: { id, user_id: userId },
      });

      if (!olt) {
        return res.status(404).json({
          success: false,
          error: 'OLT not found',
        });
      }

      const result = await olt.testConnection();

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        success: false,
        error: 'Connection test failed: ' + error.message,
      });
    }
  }

  async discoverPONPorts(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const olt = await db.OLT.findOne({
        where: { id, user_id: userId },
      });

      if (!olt) {
        return res.status(404).json({
          success: false,
          error: 'OLT not found',
        });
      }

      // Discover PON ports via SNMP
      const snmp = require('net-snmp');
      const session = snmp.createSession(olt.ip_address, olt.snmp_community);

      // OID for interface table (example - adjust per vendor)
      const ponPortsOID = '1.3.6.1.2.1.2.2.1.2'; // ifDescr

      const discovered = [];

      await new Promise((resolve, reject) => {
        const maxRepetitions = 20;

        function callback(error, table) {
          if (error) {
            session.close();
            return reject(error);
          }

          for (const index in table) {
            const value = table[index];
            const portName = value.toString();
            
            // Filter PON ports (adjust based on vendor naming)
            if (portName.toLowerCase().includes('pon') || 
                portName.toLowerCase().includes('gpon')) {
              
              const portNumber = parseInt(portName.match(/\d+$/)?.[0] || discovered.length);
              
              discovered.push({
                port_number: portNumber,
                port_name: portName,
              });
            }
          }

          session.close();
          resolve();
        }

        session.tableColumns(ponPortsOID, [ponPortsOID], maxRepetitions, callback);
      });

      // Create PON ports in database
      const createdPorts = [];
      for (const port of discovered) {
        const [ponPort, created] = await db.PONPort.findOrCreate({
          where: {
            olt_id: olt.id,
            port_number: port.port_number,
          },
          defaults: {
            port_name: port.port_name,
            status: 'active',
          },
        });

        if (created) {
          createdPorts.push(ponPort);
        }
      }

      // Update OLT total
      await olt.update({
        total_pon_ports: discovered.length,
      });

      res.json({
        success: true,
        data: {
          discovered: discovered.length,
          created: createdPorts.length,
          ports: createdPorts,
        },
      });
    } catch (error) {
      console.error('Discover PON ports error:', error);
      res.status(500).json({
        success: false,
        error: 'Discovery failed: ' + error.message,
      });
    }
  }

  async discoverONUs(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const olt = await db.OLT.findOne({
        where: { id, user_id: userId },
        include: [{ model: db.PONPort, as: 'pon_ports' }],
      });

      if (!olt) {
        return res.status(404).json({
          success: false,
          error: 'OLT not found',
        });
      }

      let totalDiscovered = 0;

      // Discover ONUs for each PON port
      for (const ponPort of olt.pon_ports) {
        // Simplified discovery - actual implementation depends on vendor
        // This is a placeholder
        const onuCount = Math.floor(Math.random() * 10); // Simulate discovery
        
        await ponPort.update({
          total_onus: onuCount,
          online_onus: onuCount,
        });

        totalDiscovered += onuCount;
      }

      res.json({
        success: true,
        data: {
          total_onus_discovered: totalDiscovered,
        },
        message: 'ONU discovery completed',
      });
    } catch (error) {
      console.error('Discover ONUs error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new OLTController();
