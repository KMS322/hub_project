module.exports = (sequelize, DataTypes) => {
  const ServerError = sequelize.define(
    'ServerError',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      channel: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      detail: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      device_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      payload_size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'server_errors',
      timestamps: false,
      indexes: [
        { fields: ['created_at'] },
        { fields: ['code'] },
        { fields: ['device_id'] },
        { fields: ['channel'] },
      ],
    }
  );
  return ServerError;
};
