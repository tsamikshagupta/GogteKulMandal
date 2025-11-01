import express from "express";
import { addFamilyMember, getAllFamilyMembers, getAllRegistrations, getRejectedMembers, updateRegistrationStatus, searchParents } from "../controllers/familyController.js";
import { upload, parseNestedFields } from "../middlewares/upload.js";

const router = express.Router();

const uploadFields = upload.fields([
  { name: "personalDetails.profileImage", maxCount: 1 },
  { name: "divorcedDetails.spouseProfileImage", maxCount: 1 },
  { name: "marriedDetails.spouseProfileImage", maxCount: 1 },
  { name: "remarriedDetails.spouseProfileImage", maxCount: 1 },
  { name: "widowedDetails.spouseProfileImage", maxCount: 1 },
  { name: "parentsInformation.fatherProfileImage", maxCount: 1 },
  { name: "parentsInformation.motherProfileImage", maxCount: 1 },
]);

// Log all POST requests to /add
router.post("/add", (req, res, next) => {
  console.log("📥 POST /api/family/add - Request received");
  next();
}, uploadFields, parseNestedFields, addFamilyMember);

router.get("/all", getAllFamilyMembers);
router.get("/registrations", getAllRegistrations);
router.get("/rejected", getRejectedMembers);
router.patch("/registrations/:id/status", updateRegistrationStatus);
router.get("/search", searchParents);

export default router;