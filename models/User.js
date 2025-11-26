import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    plainPassword: { type: String, select: false }, // For moderators, visible to super admin
    passwordChangedAt: { type: Date, select: false },
    fName: { type: String, required: true },
    lName: { type: String, required: true },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      minlength: [2, "Company name must be at least 2 characters long"],
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      validate: {
        validator: function (v) {
          return /^(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/.test(
            v
          );
        },
        message: (props) =>
          `${props.value} is not a valid US phone number! Please use format: (123) 456-7890`,
      },
      set: function (v) {
        if (!v) return v;
        const cleaned = ("" + v).replace(/\D/g, "");
        const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        if (match) {
          const intlCode = match[1] ? "+1 " : "";
          return [intlCode, "(", match[2], ") ", match[3], "-", match[4]].join(
            ""
          );
        }
        return v;
      },
    },
    oldWebsite: { type: String, default: "" },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["super_admin", "moderator", "client", "subscriber"],
      default: "client",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "blocked", "removed"],
      default: "active",
    },
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual field for full name
userSchema.virtual("fullName").get(function () {
  return `${this.fName} ${this.lName}`;
});

// Virtual field for initials (fallback when no avatar)
userSchema.virtual("initials").get(function () {
  return this.fName ? this.fName.charAt(0).toUpperCase() : "?";
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Compare passwords
userSchema.methods.comparePassword = function (pass) {
  return bcrypt.compare(pass, this.password);
};

// Check if password changed after token issue
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

export default mongoose.model("User", userSchema);
