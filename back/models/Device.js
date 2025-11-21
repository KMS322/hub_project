module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define(
    "Device",
    {
      address: {
        type: DataTypes.STRING(100),
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      hub_address: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_bin",
    }
  );
  Device.associate = (db) => {
    db.Device.belongsTo(db.Hub, { foreignKey: "hub_address" });
    db.Device.hasOne(db.Pet, { foreignKey: "device_address" });
  };

  return Device;
};
