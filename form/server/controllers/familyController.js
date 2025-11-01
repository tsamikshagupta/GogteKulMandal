import FamilyMember from "../models/FamilyMember.js";
import Members from "../models/Members.js";
import mongoose from "mongoose";

const DATA_URI_REGEX = /^data:(.+?);base64,(.+)$/;

const convertDataUriToImageObject = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  const match = normalizedValue.match(DATA_URI_REGEX);

  if (!match) {
    return null;
  }

  const [, mimeType, base64Data] = match;

  if (!mimeType || !base64Data) {
    return null;
  }

  return {
    mimeType,
    data: base64Data,
    originalName: "data-uri-upload",
  };
};

const normalizeImageDataUris = (input) => {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeImageDataUris(item));
  }

  if (input && typeof input === "object") {
    return Object.entries(input).reduce((acc, [key, value]) => {
      acc[key] = normalizeImageDataUris(value);
      return acc;
    }, {});
  }

  if (typeof input === "string") {
    const imageObject = convertDataUriToImageObject(input);
    return imageObject || input;
  }

  return input;
};

export const addFamilyMember = async (req, res) => {
  try {
    console.log("=== FORM SUBMISSION RECEIVED ===");
    console.log("Request Body:", req.body);
    console.log("Request Files:", req.files ? Object.keys(req.files) : "No files");

    // Convert uploaded files to base64
    const filesData = {};
    Object.entries(req.files || {}).forEach(([fieldPath, files]) => {
      console.log(`Processing file field: ${fieldPath}`);
      const parsed = fieldPath.split(".");
      const property = parsed.pop();
      const parentPath = parsed.join(".");

      filesData[parentPath] = filesData[parentPath] || {};
      if (files && files.length > 0) {
        const file = files[0];
        console.log(`Converting ${fieldPath} to base64 (${file.size} bytes)`);
        filesData[parentPath][property] = {
          data: file.buffer.toString("base64"),
          mimeType: file.mimetype,
          originalName: file.originalname,
        };
      }
    });

    const mergeData = (base, updates) => {
      const result = Array.isArray(base) ? [...base] : { ...base };
      Object.keys(updates).forEach((key) => {
        if (updates[key] && typeof updates[key] === "object" && !Array.isArray(updates[key])) {
          const existingValue = base?.[key] && typeof base[key] === "object" ? base[key] : {};
          result[key] = mergeData(existingValue, updates[key]);
        } else {
          result[key] = updates[key];
        }
      });
      return result;
    };

    let payload = req.body;

    if (req.files) {
      console.log("Merging file data into payload...");
      payload = Object.keys(filesData).reduce((acc, key) => {
        const keys = key.split(".");
        let pointer = acc;
        keys.forEach((k, index) => {
          if (index === keys.length - 1) {
            pointer[k] = mergeData(pointer[k], filesData[key]);
          } else {
            pointer[k] = pointer[k] || {};
            pointer = pointer[k];
          }
        });
        return acc;
      }, payload);
    }

    payload = normalizeImageDataUris(payload);

    const cleanPayload = (data) => {
      if (Array.isArray(data)) {
        const cleanedArray = data
          .map((item) => cleanPayload(item))
          .filter((item) => item !== undefined);
        return cleanedArray.length ? cleanedArray : undefined;
      }

      if (data && typeof data === "object") {
        const cleanedObject = Object.entries(data).reduce((acc, [key, value]) => {
          const cleanedValue = cleanPayload(value);
          const isEmptyObject =
            cleanedValue &&
            typeof cleanedValue === "object" &&
            !Array.isArray(cleanedValue) &&
            Object.keys(cleanedValue).length === 0;

          if (
            cleanedValue !== undefined &&
            cleanedValue !== "" &&
            !isEmptyObject
          ) {
            acc[key] = cleanedValue;
          }

          return acc;
        }, {});

        return Object.keys(cleanedObject).length ? cleanedObject : undefined;
      }

      if (data === null || data === "null" || data === "undefined") {
        return undefined;
      }

      return data;
    };

    const cleanedPayload = cleanPayload(payload) || {};

    console.log("Final Payload to Save:", JSON.stringify(cleanedPayload, null, 2));
    console.log("Creating family member in database...");

    const familyMember = await FamilyMember.create(cleanedPayload);
    
    console.log("=== FAMILY MEMBER SAVED SUCCESSFULLY ===");
    console.log("Saved Document ID:", familyMember._id);
    console.log("Saved to collection: Heirarchy_form");

    return res.status(201).json({ 
      success: true, 
      data: familyMember, 
      message: "✅ Family member saved successfully to database!",
      documentId: familyMember._id
    });
  } catch (error) {
    console.error("=== ERROR SAVING FAMILY MEMBER ===");
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    console.error("Full Error:", error);
    
    return res.status(500).json({ 
      success: false, 
      message: `❌ Error: ${error.message}`,
      error: error.message 
    });
  }
};

export const getAllFamilyMembers = async (_req, res) => {
  try {
    console.log("✅ FETCHING FROM MEMBERS COLLECTION");
    const members = await Members.find().sort({ createdAt: -1 });
    console.log(`📊 Found ${members.length} records from MEMBERS collection`);
    console.log("🔍 First member:", members[0]);
    return res.status(200).json({ success: true, data: members });
  } catch (error) {
    console.error("❌ Error fetching family members:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllRegistrations = async (_req, res) => {
  try {
    console.log("✅ FETCHING FROM HEIRARCHY_FORM COLLECTION");
    const registrations = await FamilyMember.find().sort({ createdAt: -1 });
    console.log(`📊 Found ${registrations.length} records from HEIRARCHY_FORM collection`);
    return res.status(200).json({ success: true, data: registrations });
  } catch (error) {
    console.error("❌ Error fetching registrations:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getRejectedMembers = async (_req, res) => {
  try {
    console.log("✅ FETCHING FROM REJECTEDMEMB COLLECTION");
    const db = mongoose.connection.db;
    const rejectedMembers = await db.collection('rejectedMemb').find().sort({ rejectedAt: -1 }).toArray();
    console.log(`📊 Found ${rejectedMembers.length} rejected records`);
    return res.status(200).json({ success: true, data: rejectedMembers });
  } catch (error) {
    console.error("❌ Error fetching rejected members:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    console.log(`✅ UPDATING REGISTRATION ${id} - Status: ${status}`);
    
    // Find the registration in Heirarchy_form
    const registration = await FamilyMember.findById(id);

    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    if (status === 'approved') {
      // Move to members collection
      console.log(`📦 Moving registration ${id} to members collection`);
      const memberData = registration.toObject();
      delete memberData._id; // Remove the old _id so MongoDB generates a new one
      delete memberData.status;
      delete memberData.adminNotes;
      delete memberData.reviewedAt;
      
      await Members.create(memberData);
      await FamilyMember.findByIdAndDelete(id);
      
      console.log(`✅ Registration approved and moved to members collection`);
      return res.status(200).json({ 
        success: true, 
        message: "Registration approved and moved to members collection",
        data: { id, status: 'approved' }
      });

    } else if (status === 'rejected') {
      console.log(`📦 Moving registration ${id} to rejectedMemb collection`);
      
      // Get the raw document data
      const rejectedData = registration.toObject();
      rejectedData.adminNotes = adminNotes || '';
      rejectedData.rejectedAt = new Date();
      delete rejectedData._id; // Remove _id to let MongoDB generate a new one
      
      // Insert directly into rejectedMemb collection without validation
      const db = registration.constructor.db;
      await db.collection('rejectedMemb').insertOne(rejectedData);
      
      // Delete from Heirarchy_form
      await FamilyMember.findByIdAndDelete(id);
      
      console.log(`✅ Registration rejected and moved to rejectedMemb collection`);
      return res.status(200).json({ 
        success: true, 
        message: "Registration rejected and moved to rejectedMemb collection",
        data: { id, status: 'rejected' }
      });

    } else {
      // Just update status for other cases (under_review, pending, etc.)
      const updatedRegistration = await FamilyMember.findByIdAndUpdate(
        id,
        { 
          status,
          adminNotes,
          reviewedAt: new Date()
        },
        { new: true }
      );

      console.log(`📊 Updated registration ${id} status to ${status}`);
      return res.status(200).json({ success: true, data: updatedRegistration });
    }

  } catch (error) {
    console.error("❌ Error updating registration:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

export const searchParents = async (req, res) => {
  try {
    const { query, vansh } = req.query;

    console.log("🔍 Parent Search - Query:", query, "Vansh:", vansh);

    if (!query || query.trim().length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    if (!vansh) {
      return res.status(200).json({ success: true, data: [], message: "Vansh is required to search for parents" });
    }

    // Reduce DB load: avoid count/findOne on every request and use a query
    // that can leverage an index on `vansh` while applying regex on name
    // fields for the filtered set. This reduces full-collection scans.
  // Anchor regex to start to enable prefix index usage (faster for autocomplete)
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(`^${escapeRegExp(query)}`, "i");

    const members = await Members.find({
      vansh: String(vansh),
      $or: [
        { "personalDetails.firstName": { $regex: searchRegex } },
        { "personalDetails.middleName": { $regex: searchRegex } },
        { "personalDetails.lastName": { $regex: searchRegex } },
      ],
    })
      .select("serNo personalDetails vansh")
      .limit(10);

    console.log(`✅ Found ${members.length} matching members for vansh: ${vansh}`);

    const formattedMembers = members.map((member) => ({
      id: member._id,
      serNo: member.serNo || null,
      firstName: member.personalDetails?.firstName || "",
      middleName: member.personalDetails?.middleName || "",
      lastName: member.personalDetails?.lastName || "",
      dateOfBirth: member.personalDetails?.dateOfBirth 
        ? new Date(member.personalDetails.dateOfBirth).toISOString().split("T")[0] 
        : "",
      profileImage: member.personalDetails?.profileImage || null,
      gender: member.personalDetails?.gender || "",
      email: member.personalDetails?.email || "",
      mobileNumber: member.personalDetails?.mobileNumber || "",
      vansh: member.vansh || "",
      displayName: `${member.personalDetails?.firstName || ""} ${member.personalDetails?.middleName || ""} ${
        member.personalDetails?.lastName || ""
      }`.trim(),
    }));

    return res.status(200).json({ success: true, data: formattedMembers });
  } catch (error) {
    console.error("❌ Error searching parents:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};