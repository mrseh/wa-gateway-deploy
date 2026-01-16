/**
 * Migration: Create Database Functions and Triggers
 * Description: Utility functions and automated triggers for business logic
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Function: Update timestamp automatically
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Apply updated_at trigger to all relevant tables
    const tables = [
      'users', 'packages', 'subscriptions', 'instances', 
      'olts', 'pon_ports', 'onus', 'message_logs', 'transactions'
    ];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Function: Calculate subscription usage
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION calculate_subscription_usage(sub_id UUID)
      RETURNS JSONB AS $$
      DECLARE
        usage JSONB;
      BEGIN
        SELECT jsonb_build_object(
          'instances_used', COUNT(DISTINCT i.id),
          'messages_sent', COUNT(CASE WHEN ml.direction = 'outbound' THEN 1 END),
          'olts_added', COUNT(DISTINCT o.id),
          'storage_used_mb', COALESCE(SUM(ml.media_size) / 1048576, 0)
        )
        INTO usage
        FROM subscriptions s
        LEFT JOIN instances i ON i.user_id = s.user_id
        LEFT JOIN message_logs ml ON ml.user_id = s.user_id 
          AND ml.created_at >= s.started_at
        LEFT JOIN olts o ON o.user_id = s.user_id
        WHERE s.id = sub_id
        GROUP BY s.id;
        
        RETURN usage;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function: Check quota before sending message
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_message_quota(inst_id UUID)
      RETURNS BOOLEAN AS $$
      DECLARE
        daily_count INTEGER;
        daily_limit INTEGER;
        sub_record RECORD;
      BEGIN
        -- Get instance and subscription info
        SELECT 
          s.id as subscription_id,
          p.max_messages_per_day,
          (SELECT COUNT(*) 
           FROM message_logs 
           WHERE instance_id = inst_id 
           AND direction = 'outbound'
           AND created_at >= CURRENT_DATE
          ) as today_count
        INTO sub_record
        FROM instances i
        JOIN users u ON u.id = i.user_id
        JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'trial')
        JOIN packages p ON p.id = s.package_id
        WHERE i.id = inst_id;
        
        -- Check if under limit
        IF sub_record.today_count < sub_record.max_messages_per_day THEN
          RETURN TRUE;
        ELSE
          RETURN FALSE;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function: Update PON port statistics when ONU status changes
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_pon_port_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE pon_ports
        SET 
          online_onus = (
            SELECT COUNT(*) FROM onus 
            WHERE pon_port_id = NEW.pon_port_id 
            AND status = 'online'
          ),
          offline_onus = (
            SELECT COUNT(*) FROM onus 
            WHERE pon_port_id = NEW.pon_port_id 
            AND status IN ('offline', 'los')
          ),
          total_onus = (
            SELECT COUNT(*) FROM onus 
            WHERE pon_port_id = NEW.pon_port_id
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.pon_port_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Update PON port stats when ONU changes
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_pon_stats_on_onu_change
      AFTER INSERT OR UPDATE OF status ON onus
      FOR EACH ROW
      EXECUTE FUNCTION update_pon_port_stats();
    `);

    // Function: Update OLT statistics when PON port changes
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_olt_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE olts
        SET 
          total_pon_ports = (
            SELECT COUNT(*) FROM pon_ports 
            WHERE olt_id = NEW.olt_id
          ),
          total_onus = (
            SELECT COUNT(*) FROM onus o
            JOIN pon_ports pp ON pp.id = o.pon_port_id
            WHERE pp.olt_id = NEW.olt_id
          ),
          online_onus = (
            SELECT COUNT(*) FROM onus o
            JOIN pon_ports pp ON pp.id = o.pon_port_id
            WHERE pp.olt_id = NEW.olt_id AND o.status = 'online'
          ),
          offline_onus = (
            SELECT COUNT(*) FROM onus o
            JOIN pon_ports pp ON pp.id = o.pon_port_id
            WHERE pp.olt_id = NEW.olt_id AND o.status IN ('offline', 'los')
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.olt_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Update OLT stats when PON port changes
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_olt_stats_on_pon_change
      AFTER INSERT OR UPDATE ON pon_ports
      FOR EACH ROW
      EXECUTE FUNCTION update_olt_stats();
    `);

    // Function: Log ONU status change events
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION log_onu_status_change()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO onu_events (onu_id, event_type, old_status, new_status, description)
          VALUES (
            NEW.id,
            'status_change',
            OLD.status,
            NEW.status,
            'ONU status changed from ' || OLD.status || ' to ' || NEW.status
          );
          
          -- Update last online/offline timestamps
          IF NEW.status = 'online' THEN
            NEW.last_online_at = CURRENT_TIMESTAMP;
          ELSIF NEW.status IN ('offline', 'los') THEN
            NEW.last_offline_at = CURRENT_TIMESTAMP;
            NEW.offline_count = OLD.offline_count + 1;
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Log ONU status changes
    await queryInterface.sequelize.query(`
      CREATE TRIGGER log_onu_status_change_trigger
      BEFORE UPDATE OF status ON onus
      FOR EACH ROW
      EXECUTE FUNCTION log_onu_status_change();
    `);

    // Function: Update instance statistics
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_instance_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE instances
        SET 
          statistics = jsonb_set(
            statistics,
            '{messages_sent}',
            to_jsonb((statistics->>'messages_sent')::int + 1)
          ),
          statistics = jsonb_set(
            statistics,
            '{last_message_at}',
            to_jsonb(CURRENT_TIMESTAMP::text)
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.instance_id AND NEW.direction = 'outbound';
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Update instance stats on message
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_instance_stats_on_message
      AFTER INSERT ON message_logs
      FOR EACH ROW
      EXECUTE FUNCTION update_instance_stats();
    `);

    // Function: Update daily message quota
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_message_quota()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE instances
        SET 
          quota = jsonb_set(
            quota,
            '{daily_messages}',
            to_jsonb((quota->>'daily_messages')::int + 1)
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.instance_id 
        AND NEW.direction = 'outbound'
        AND NEW.status != 'failed';
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: Update quota on successful message
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_quota_on_message
      AFTER INSERT ON message_logs
      FOR EACH ROW
      WHEN (NEW.status IN ('sent', 'delivered'))
      EXECUTE FUNCTION update_message_quota();
    `);

    // Function: Reset daily quotas (to be called by cron)
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION reset_daily_quotas()
      RETURNS void AS $$
      BEGIN
        UPDATE instances
        SET quota = jsonb_set(
          jsonb_set(
            quota,
            '{daily_messages}',
            '0'
          ),
          '{last_reset}',
          to_jsonb(CURRENT_TIMESTAMP::text)
        );
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function: Check subscription expiry and send notifications
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_subscription_expiry()
      RETURNS TABLE(subscription_id UUID, user_id UUID, days_until_expiry INTEGER) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          s.id,
          s.user_id,
          EXTRACT(DAY FROM (s.expires_at - CURRENT_TIMESTAMP))::INTEGER
        FROM subscriptions s
        WHERE s.status = 'active'
        AND s.expires_at IS NOT NULL
        AND s.expires_at > CURRENT_TIMESTAMP
        AND s.expires_at <= CURRENT_TIMESTAMP + INTERVAL '7 days'
        ORDER BY s.expires_at ASC;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function: Calculate PON port health score
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION calculate_pon_health_score(port_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
        score INTEGER := 100;
        port_record RECORD;
      BEGIN
        SELECT 
          utilization,
          temperature,
          avg_rx_power,
          online_onus,
          total_onus,
          oper_status
        INTO port_record
        FROM pon_ports
        WHERE id = port_id;
        
        -- Deduct points based on utilization
        IF port_record.utilization > 90 THEN
          score := score - 30;
        ELSIF port_record.utilization > 80 THEN
          score := score - 20;
        ELSIF port_record.utilization > 70 THEN
          score := score - 10;
        END IF;
        
        -- Deduct points based on temperature
        IF port_record.temperature > 70 THEN
          score := score - 20;
        ELSIF port_record.temperature > 60 THEN
          score := score - 10;
        END IF;
        
        -- Deduct points based on RX power
        IF port_record.avg_rx_power < -25 OR port_record.avg_rx_power > -10 THEN
          score := score - 15;
        END IF;
        
        -- Deduct points based on offline ONUs
        IF port_record.total_onus > 0 THEN
          IF (port_record.total_onus - port_record.online_onus)::FLOAT / port_record.total_onus > 0.2 THEN
            score := score - 25;
          ELSIF (port_record.total_onus - port_record.online_onus)::FLOAT / port_record.total_onus > 0.1 THEN
            score := score - 15;
          END IF;
        END IF;
        
        -- Deduct points if port is down
        IF port_record.oper_status = 'down' THEN
          score := 0;
        END IF;
        
        -- Ensure score is within bounds
        IF score < 0 THEN
          score := 0;
        END IF;
        
        RETURN score;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function: Calculate ONU health score
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION calculate_onu_health_score(onu_record_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
        score INTEGER := 100;
        onu_record RECORD;
      BEGIN
        SELECT 
          status,
          rx_power,
          temperature,
          offline_count
        INTO onu_record
        FROM onus
        WHERE id = onu_record_id;
        
        -- Deduct points based on status
        IF onu_record.status = 'offline' THEN
          score := 0;
        ELSIF onu_record.status = 'los' THEN
          score := 10;
        ELSIF onu_record.status = 'dying_gasp' THEN
          score := 20;
        END IF;
        
        -- Deduct points based on RX power (if online)
        IF onu_record.status = 'online' THEN
          IF onu_record.rx_power < -25 OR onu_record.rx_power > -10 THEN
            score := score - 20;
          ELSIF onu_record.rx_power < -23 OR onu_record.rx_power > -12 THEN
            score := score - 10;
          END IF;
          
          -- Deduct points based on temperature
          IF onu_record.temperature > 70 THEN
            score := score - 15;
          ELSIF onu_record.temperature > 60 THEN
            score := score - 10;
          END IF;
          
          -- Deduct points based on offline history
          IF onu_record.offline_count > 10 THEN
            score := score - 15;
          ELSIF onu_record.offline_count > 5 THEN
            score := score - 10;
          END IF;
        END IF;
        
        -- Ensure score is within bounds
        IF score < 0 THEN
          score := 0;
        END IF;
        
        RETURN score;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create alert_templates table for monitoring alerts
    await queryInterface.createTable('alert_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      category: {
        type: Sequelize.ENUM('mikrotik', 'pon', 'zabbix', 'instance', 'subscription', 'system'),
        allowNull: false
      },
      emoji: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      template: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Message template with variable placeholders'
      },
      variables: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
        comment: 'List of available variables'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active',
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

    // Indexes for alert_templates
    await queryInterface.addIndex('alert_templates', ['category'], {
      name: 'idx_alert_templates_category'
    });

    await queryInterface.addIndex('alert_templates', ['status'], {
      name: 'idx_alert_templates_status'
    });

    // Create alerts table
    await queryInterface.createTable('alerts', {
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
      category: {
        type: Sequelize.ENUM('mikrotik', 'pon', 'zabbix', 'instance', 'subscription', 'system'),
        allowNull: false
      },
      severity: {
        type: Sequelize.ENUM('info', 'warning', 'critical'),
        defaultValue: 'info',
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      source_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of related entity (OLT, PON port, etc.)'
      },
      source_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Type of related entity'
      },
      status: {
        type: Sequelize.ENUM('active', 'acknowledged', 'resolved'),
        defaultValue: 'active',
        allowNull: false
      },
      acknowledged_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      acknowledged_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notification_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      notification_sent_at: {
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

    // Indexes for alerts
    await queryInterface.addIndex('alerts', ['user_id'], {
      name: 'idx_alerts_user_id'
    });

    await queryInterface.addIndex('alerts', ['category'], {
      name: 'idx_alerts_category'
    });

    await queryInterface.addIndex('alerts', ['severity'], {
      name: 'idx_alerts_severity'
    });

    await queryInterface.addIndex('alerts', ['status'], {
      name: 'idx_alerts_status'
    });

    await queryInterface.addIndex('alerts', ['created_at'], {
      name: 'idx_alerts_created_at'
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE alert_templates IS 'Message templates for various alert types';
      COMMENT ON TABLE alerts IS 'System alerts and notifications';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables
    await queryInterface.dropTable('alerts');
    await queryInterface.dropTable('alert_templates');

    // Drop triggers
    const tables = [
      'users', 'packages', 'subscriptions', 'instances', 
      'olts', 'pon_ports', 'onus', 'message_logs', 'transactions'
    ];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
      `);
    }

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_pon_stats_on_onu_change ON onus;
      DROP TRIGGER IF EXISTS update_olt_stats_on_pon_change ON pon_ports;
      DROP TRIGGER IF EXISTS log_onu_status_change_trigger ON onus;
      DROP TRIGGER IF EXISTS update_instance_stats_on_message ON message_logs;
      DROP TRIGGER IF EXISTS update_quota_on_message ON message_logs;
    `);

    // Drop functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS update_updated_at_column();
      DROP FUNCTION IF EXISTS calculate_subscription_usage(UUID);
      DROP FUNCTION IF EXISTS check_message_quota(UUID);
      DROP FUNCTION IF EXISTS update_pon_port_stats();
      DROP FUNCTION IF EXISTS update_olt_stats();
      DROP FUNCTION IF EXISTS log_onu_status_change();
      DROP FUNCTION IF EXISTS update_instance_stats();
      DROP FUNCTION IF EXISTS update_message_quota();
      DROP FUNCTION IF EXISTS reset_daily_quotas();
      DROP FUNCTION IF EXISTS check_subscription_expiry();
      DROP FUNCTION IF EXISTS calculate_pon_health_score(UUID);
      DROP FUNCTION IF EXISTS calculate_onu_health_score(UUID);
    `);
  }
};
