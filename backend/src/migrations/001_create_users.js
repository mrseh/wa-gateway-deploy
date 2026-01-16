/**
 * Migration: Create Users Table
 * Description: Main users table with authentication and profile information
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true
      },
      company_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      company_address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('admin', 'user'),
        defaultValue: 'user',
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended', 'deleted'),
        defaultValue: 'inactive',
        allowNull: false
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      email_verification_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      password_reset_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_login_ip: {
        type: Sequelize.INET,
        allowNull: true
      },
      login_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      locked_until: {
        type: Sequelize.DATE,
        allowNull: true
      },
      two_factor_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      two_factor_secret: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      timezone: {
        type: Sequelize.STRING(50),
        defaultValue: 'Asia/Jakarta',
        allowNull: false
      },
      language: {
        type: Sequelize.STRING(10),
        defaultValue: 'id',
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

    // Indexes for performance
    await queryInterface.addIndex('users', ['email'], {
      name: 'idx_users_email',
      unique: true
    });

    await queryInterface.addIndex('users', ['phone'], {
      name: 'idx_users_phone',
      unique: true,
      where: {
        phone: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('users', ['status'], {
      name: 'idx_users_status'
    });

    await queryInterface.addIndex('users', ['role'], {
      name: 'idx_users_role'
    });

    await queryInterface.addIndex('users', ['email_verification_token'], {
      name: 'idx_users_email_verification_token',
      where: {
        email_verification_token: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('users', ['password_reset_token'], {
      name: 'idx_users_password_reset_token',
      where: {
        password_reset_token: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('users', ['created_at'], {
      name: 'idx_users_created_at'
    });

    // Add constraints
    await queryInterface.addConstraint('users', {
      fields: ['email'],
      type: 'check',
      name: 'check_users_email_format',
      where: {
        email: {
          [Sequelize.Op.regexp]: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'
        }
      }
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE users IS 'Main users table with authentication and profile information';
      COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
      COMMENT ON COLUMN users.email IS 'User email address (unique)';
      COMMENT ON COLUMN users.password IS 'Hashed password (bcrypt)';
      COMMENT ON COLUMN users.role IS 'User role (admin, user)';
      COMMENT ON COLUMN users.status IS 'Account status (active, inactive, suspended, deleted)';
      COMMENT ON COLUMN users.email_verified IS 'Email verification status';
      COMMENT ON COLUMN users.login_attempts IS 'Failed login attempts counter';
      COMMENT ON COLUMN users.locked_until IS 'Account lock expiration timestamp';
      COMMENT ON COLUMN users.two_factor_enabled IS '2FA status';
      COMMENT ON COLUMN users.metadata IS 'Additional user metadata (JSONB)';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
