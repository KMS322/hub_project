const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../models");
const { verifyToken } = require("../middlewares/auth");

const generateToken = (user) => {
  return jwt.sign(
    {
      email: user.email,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
  );
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, postcode, address, detail_address, phone } =
      req.body;

    if (
      !email ||
      !password ||
      !name ||
      !postcode ||
      !address ||
      !detail_address ||
      !phone
    ) {
      return res.status(400).json({
        success: false,
        message: "필수 항목을 모두 입력해주세요.",
      });
    }

    const existingUser = await db.User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "이미 존재하는 이메일입니다.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.User.create({
      email,
      password: hashedPassword,
      name,
      postcode,
      address,
      detail_address,
      phone,
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "회원가입이 완료되었습니다.",
      data: {
        user: {
          email: user.email,
          name: user.name,
          postcode: user.postcode,
          address: user.address,
          detail_address: user.detail_address,
          phone: user.phone,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "회원가입 중 오류가 발생했습니다.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "이메일과 비밀번호를 입력해주세요.",
      });
    }

    const user = await db.User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: "로그인에 성공했습니다.",
      data: {
        user: {
          email: user.email,
          name: user.name,
          postcode: user.postcode,
          address: user.address,
          detail_address: user.detail_address,
          phone: user.phone,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "로그인 중 오류가 발생했습니다.",
    });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          email: user.email,
          name: user.name,
          postcode: user.postcode,
          address: user.address,
          detail_address: user.detail_address,
          phone: user.phone,
        },
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "사용자 정보 조회 중 오류가 발생했습니다.",
    });
  }
});

router.post("/logout", verifyToken, (req, res) => {
  res.json({
    success: true,
    message: "로그아웃되었습니다.",
  });
});

module.exports = router;
