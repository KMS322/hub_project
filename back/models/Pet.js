module.exports = (sequelize, DataTypes) => {
  const Pet = sequelize.define(
    "Pet",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      species: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      breed: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      weight: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      gender: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      neutering: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      birthDate: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      admissionDate: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      veterinarian: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      diagnosis: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      medicalHistory: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      user_email: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      device_address: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "입원중",
      },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_bin",
    }
  );
  Pet.associate = (db) => {
    db.Pet.belongsTo(db.User, { foreignKey: "user_email" });
    db.Pet.belongsTo(db.Device, { foreignKey: "device_address" });
  };

  return Pet;
};
