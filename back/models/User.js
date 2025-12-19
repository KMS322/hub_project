module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      email: {
        type: DataTypes.STRING(100),
        primaryKey: true,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      postcode: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      detail_address: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
    },
    {
      tableName: "Users", // 명시적으로 테이블 이름 지정
      charset: "utf8mb4",
      collate: "utf8mb4_bin",
    }
  );
  User.associate = (db) => {
    db.User.hasMany(db.Hub, { foreignKey: "user_email" });
    db.User.hasMany(db.Pet, { foreignKey: "user_email" });
  };
  return User;
};
