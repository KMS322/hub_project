module.exports = (sequelize, DataTypes) => {
  const Hub = sequelize.define(
    "Hub",
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
      user_email: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      is_change: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_bin",
    }
  );
  Hub.associate = (db) => {
    db.Hub.belongsTo(db.User, { foreignKey: "user_email" });
    db.Hub.hasMany(db.Device, { foreignKey: "hub_address" });
  };

  return Hub;
};
