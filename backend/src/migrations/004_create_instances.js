/**
 * Migration: Create Instances Table
 * Description: WhatsApp instances managed by Evolution API
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('instances', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'User-friendly instance name'
      },
      instance_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Evolution API instance name (unique)'
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Connected WhatsApp phone number'
      },
      status: {
        type: Sequelize.ENUM(
          'creating',
          'waiting_qr',
          'connected',
          'disconnected',
          'error',
          'suspended'
        ),
        defaultValue: 'creating',
        allowNull: false
      },
      qr_code: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Base64 encoded QR code'
      },
      qr_code_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      api_key: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Evolution API instance key'
      },
      webhook_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      webhook_events: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [
          'messages.upsert',
          'messages.update',
          'connection.update',
          'qr.updated',
          'groups.upsert'
        ],
        allowNull: false
      },
      connected_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      disconnected_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last activity timestamp'
      },
      connection_state: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Evolution API connection state'
      },
      profile_picture_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      profile_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          auto_reply: false,
          read_messages: true,
          reject_calls: false,
          always_online: false,
          message_delay: 2000
        },
        allowNull: false
      },
      statistics: {
        type: Sequelize.JSONB,
        defaultValue: {
          messages_sent: 0,
          messages_received: 0,
          messages_failed: 0,
          last_message_at: null,
          uptime_percentage: 100,
          connection_drops: 0
        },
        allowNull: false
      },
      quota: {
        type: Sequelize.JSONB,
        defaultValue: {
          daily_messages: 0,
          daily_limit: 1000,
          monthly_messages: 0,
          last_reset: null
        },
        allowNull: false
      },
      error_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      last_error_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      auto_reconnect: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      reconnect_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      max_reconnect_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Indexes
    await queryInterface.addIndex('instances', ['user_id'], {
      name: 'idx_instances_user_id'
    });

    await queryInterface.addIndex('instances', ['instance_name'], {
      name: 'idx_instances_instance_name',
      unique: true
    });

    await queryInterface.addIndex('instances', ['phone_number'], {
      name: 'idx_instances_phone_number'
    });

    await queryInterface.addIndex('instances', ['status'], {
      name: 'idx_instances_status'
    });

    await queryInterface.addIndex('instances', ['user_id', 'status'], {
      name: 'idx_instances_user_status'
    });

    await queryInterface.addIndex('instances', ['connected_at'], {
      name: 'idx_instances_connected_at'
    });

    await queryInterface.addIndex('instances', ['last_seen'], {
      name: 'idx_instances_last_seen'
    });

    // Add constraints
    await queryInterface.addConstraint('instances', {
      fields: ['error_count'],
      type: 'check',
      name: 'check_instances_error_count_positive',
      where: {
        error_count: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE instances IS 'WhatsApp instances managed by Evolution API';
      COMMENT ON COLUMN instances.instance_name IS 'Unique identifier for Evolution API instance';
      COMMENT ON COLUMN instances.status IS 'Instance connection status';
      COMMENT ON COLUMN instances.qr_code IS 'Base64 encoded QR code for pairing';
      COMMENT ON COLUMN instances.webhook_url IS 'Webhook URL for receiving events';
      COMMENT ON COLUMN instances.settings IS 'Instance configuration settings';
      COMMENT ON COLUMN instances.statistics IS 'Usage and performance statistics';
      COMMENT ON COLUMN instances.quota IS 'Message quota tracking';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('instances');
  }
};
