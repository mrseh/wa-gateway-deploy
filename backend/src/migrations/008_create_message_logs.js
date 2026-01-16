/**
 * Migration: Create Message Logs Table
 * Description: Log of all WhatsApp messages sent and received
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('message_logs', {
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
      instance_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'instances',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'WhatsApp message ID'
      },
      direction: {
        type: Sequelize.ENUM('inbound', 'outbound'),
        allowNull: false
      },
      from_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Sender phone number'
      },
      to_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Recipient phone number'
      },
      message_type: {
        type: Sequelize.ENUM('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'template'),
        defaultValue: 'text',
        allowNull: false
      },
      message_content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Message text content'
      },
      media_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Media file URL'
      },
      media_mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      media_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Media file size in bytes'
      },
      caption: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      quoted_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'ID of quoted/replied message'
      },
      is_group: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      group_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'WhatsApp group ID'
      },
      group_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'deleted'),
        defaultValue: 'pending',
        allowNull: false
      },
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      retry_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      is_bulk: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Part of bulk message campaign'
      },
      bulk_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Bulk message batch ID'
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Message template ID'
      },
      template_variables: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
        comment: 'Template variable values'
      },
      cost: {
        type: Sequelize.DECIMAL(10, 6),
        defaultValue: 0,
        allowNull: false,
        comment: 'Message cost (if applicable)'
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
      }
    });

    // Indexes
    await queryInterface.addIndex('message_logs', ['user_id'], {
      name: 'idx_message_logs_user_id'
    });

    await queryInterface.addIndex('message_logs', ['instance_id'], {
      name: 'idx_message_logs_instance_id'
    });

    await queryInterface.addIndex('message_logs', ['message_id'], {
      name: 'idx_message_logs_message_id'
    });

    await queryInterface.addIndex('message_logs', ['direction'], {
      name: 'idx_message_logs_direction'
    });

    await queryInterface.addIndex('message_logs', ['status'], {
      name: 'idx_message_logs_status'
    });

    await queryInterface.addIndex('message_logs', ['message_type'], {
      name: 'idx_message_logs_message_type'
    });

    await queryInterface.addIndex('message_logs', ['from_number'], {
      name: 'idx_message_logs_from_number'
    });

    await queryInterface.addIndex('message_logs', ['to_number'], {
      name: 'idx_message_logs_to_number'
    });

    await queryInterface.addIndex('message_logs', ['bulk_id'], {
      name: 'idx_message_logs_bulk_id',
      where: {
        bulk_id: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('message_logs', ['group_id'], {
      name: 'idx_message_logs_group_id',
      where: {
        group_id: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('message_logs', ['created_at'], {
      name: 'idx_message_logs_created_at'
    });

    await queryInterface.addIndex('message_logs', ['user_id', 'direction', 'created_at'], {
      name: 'idx_message_logs_user_direction_date'
    });

    await queryInterface.addIndex('message_logs', ['user_id', 'status'], {
      name: 'idx_message_logs_user_status'
    });

    // Create webhook_logs table for Evolution API webhooks
    await queryInterface.createTable('webhook_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      instance_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'instances',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Webhook event type'
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Full webhook payload'
      },
      processed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Indexes for webhook_logs
    await queryInterface.addIndex('webhook_logs', ['instance_id'], {
      name: 'idx_webhook_logs_instance_id'
    });

    await queryInterface.addIndex('webhook_logs', ['event_type'], {
      name: 'idx_webhook_logs_event_type'
    });

    await queryInterface.addIndex('webhook_logs', ['processed'], {
      name: 'idx_webhook_logs_processed'
    });

    await queryInterface.addIndex('webhook_logs', ['created_at'], {
      name: 'idx_webhook_logs_created_at'
    });

    // Create transactions table for payment tracking
    await queryInterface.createTable('transactions', {
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
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      invoice_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      payment_gateway: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'midtrans'
      },
      payment_gateway_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Payment gateway transaction ID'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'IDR',
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded'),
        defaultValue: 'pending',
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      payment_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
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
      }
    });

    // Indexes for transactions
    await queryInterface.addIndex('transactions', ['user_id'], {
      name: 'idx_transactions_user_id'
    });

    await queryInterface.addIndex('transactions', ['subscription_id'], {
      name: 'idx_transactions_subscription_id'
    });

    await queryInterface.addIndex('transactions', ['invoice_number'], {
      name: 'idx_transactions_invoice_number',
      unique: true
    });

    await queryInterface.addIndex('transactions', ['status'], {
      name: 'idx_transactions_status'
    });

    await queryInterface.addIndex('transactions', ['payment_gateway_id'], {
      name: 'idx_transactions_payment_gateway_id'
    });

    await queryInterface.addIndex('transactions', ['created_at'], {
      name: 'idx_transactions_created_at'
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE message_logs IS 'Log of all WhatsApp messages sent and received';
      COMMENT ON COLUMN message_logs.direction IS 'Message direction (inbound, outbound)';
      COMMENT ON COLUMN message_logs.status IS 'Message delivery status';
      COMMENT ON COLUMN message_logs.is_bulk IS 'Whether message is part of bulk campaign';
      
      COMMENT ON TABLE webhook_logs IS 'Log of Evolution API webhook events';
      COMMENT ON TABLE transactions IS 'Payment transaction records';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('transactions');
    await queryInterface.dropTable('webhook_logs');
    await queryInterface.dropTable('message_logs');
  }
};
