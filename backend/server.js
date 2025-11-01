import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import createAuthRouter from './routes/auth.js';
import fs from 'fs';
import { verifyToken, requireDBA, requireAdmin } from './middleware/auth.js';
import { upload, parseNestedFields } from './middleware/upload.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global error handler for JSON parsing errors
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('JSON parsing error:', error.message);
    return res.status(400).json({ message: 'Invalid JSON format' });
  }
  next();
});

const mongoUri = 'mongodb+srv://gogtekulam:gogtekul@cluster0.t3c0jt6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const dbName = 'test';
const collectionName = 'members';
const newsCollectionName = 'news';
const eventsCollectionName = 'events';
const sheetsCollectionName = 'members';

let client;
let db;

async function connectToMongo() {
  if (db) return db;
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);
  try {
    // Ensure unique index for dedupe on GogteKulamandalFamily
    await db.collection(collectionName).createIndex({ _sheetRowKey: 1 }, { unique: true, name: 'uniq_sheet_row_key' });
  } catch (e) {
    // ignore index errors if already exists
  }
  return db;
}

// Utility: convert flat objects with dot-notation keys into nested objects
// Example: { 'personalDetails.firstName': 'Abhinav', 'parentsInformation.fatherFirstName': 'Umesh' }
// becomes { personalDetails: { firstName: 'Abhinav' }, parentsInformation: { fatherFirstName: 'Umesh' } }
function nestObject(flatObj) {
  if (!flatObj || typeof flatObj !== 'object') return flatObj;
  const nested = {};

  // First, copy non-dot keys shallowly (they may be objects already)
  Object.keys(flatObj).forEach((key) => {
    if (!key.includes('.')) {
      // If the value is an object, clone it to avoid mutation of original
      nested[key] = flatObj[key] && typeof flatObj[key] === 'object' && !Array.isArray(flatObj[key])
        ? { ...flatObj[key] }
        : flatObj[key];
    }
  });

  // Then process dotted keys and merge into nested structure
  Object.keys(flatObj).forEach((key) => {
    if (!key.includes('.')) return;
    const parts = key.split('.');
    let cursor = nested;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        // Assign value, overwriting only if necessary
        cursor[part] = flatObj[key];
      } else {
        if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
          cursor[part] = {};
        }
        cursor = cursor[part];
      }
    }
  });

  return nested;
}

// Initialize mongoose (used for the optional example route using Model.save())
try {
  mongoose.connect(mongoUri, { dbName, autoIndex: false });
  // Create a permissive schema so we can save arbitrary member shapes
  const memberSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  // Use the same collectionName so saved docs are in the same place as inserts
  mongoose.models.Member || mongoose.model('Member', memberSchema, collectionName);
} catch (e) {
  console.warn('Mongoose init warning:', e && e.message ? e.message : e);
}





app.get('/api/family/members', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    let query = {};
    
    // Handle level filtering for root members
    if (req.query.level) {
      const level = parseInt(req.query.level);
      query.level = level;
    }
    
    const members = await collection.find(query).toArray();
    console.log(`[family] db=${dbName} coll=${collectionName} query=${JSON.stringify(query)} count=${members.length}`);
    res.json({ members });
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Fetch members by multiple serial numbers (for children)
app.post('/api/family/members/by-sernos', async (req, res) => {
  try {
    const { serNos } = req.body;
    if (!Array.isArray(serNos) || serNos.length === 0) {
      return res.json({ members: [] });
    }

    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Convert serNos to appropriate types (number or string)
    const normalizedSerNos = serNos.map(sn => {
      const num = Number(sn);
      return Number.isNaN(num) ? String(sn) : num;
    });
    
    const query = {
      $or: [
        { serNo: { $in: serNos } },
        { serNo: { $in: normalizedSerNos } }
      ]
    };
    
    const members = await collection.find(query).toArray();
    console.log(`[family] Fetched ${members.length} members by serNos:`, serNos);
    res.json({ members });
  } catch (err) {
    console.error('Error fetching members by serNos:', err);
    res.status(500).json({ error: 'Failed to fetch members by serial numbers' });
  }
});

// Fetch a single member by serial number (for spouse)
app.get('/api/family/members/by-serno/:serNo', async (req, res) => {
  try {
    const { serNo } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Try both number and string versions
    const num = Number(serNo);
    const searchValues = Number.isNaN(num) ? [String(serNo)] : [num, String(serNo)];
    
    const query = {
      serNo: { $in: searchValues }
    };
    
    const member = await collection.findOne(query);
    console.log(`[family] Fetched member by serNo ${serNo}:`, member ? 'found' : 'not found');
    res.json({ member });
  } catch (err) {
    console.error('Error fetching member by serNo:', err);
    res.status(500).json({ error: 'Failed to fetch member by serial number' });
  }
});

// New endpoint for visual family tree - returns all members
app.get('/api/family/members-new', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const members = await collection.find({}).toArray();
    console.log(`[family] Fetched all members for visual tree: ${members.length}`);
    res.json(members);
  } catch (err) {
    console.error('Error fetching all members:', err);
    res.status(500).json({ error: 'Failed to fetch all members' });
  }
});

// Search members for parent autocomplete
app.get('/api/family/search', async (req, res) => {
  try {
    const { query, vansh } = req.query;

    if (!query || !vansh) {
      return res.status(400).json({
        success: false,
        data: []
      });
    }

    const database = await connectToMongo();
    const collection = database.collection(collectionName);

    const searchRegex = new RegExp(query, 'i');
    const vanshNum = Number(vansh);

    const vanshConditions = Number.isNaN(vanshNum)
      ? [
          { vansh: vansh },
          { 'personalDetails.vansh': vansh }
        ]
      : [
          { vansh: vanshNum },
          { vansh: vansh.toString() },
          { 'personalDetails.vansh': vanshNum },
          { 'personalDetails.vansh': vansh.toString() }
        ];

    const members = await collection
      .find({
        $and: [
          {
            $or: [
              { 'personalDetails.firstName': searchRegex },
              { 'personalDetails.lastName': searchRegex },
              { 'personalDetails.middleName': searchRegex },
              { name: searchRegex },
              { firstName: searchRegex },
              { lastName: searchRegex },
              { middleName: searchRegex }
            ]
          },
          { $or: vanshConditions }
        ]
      })
      .limit(10)
      .toArray();

    const data = members.map((member) => {
      const personal = member.personalDetails || {};
      const profileImage = personal.profileImage || member.profileImage || null;
      const mobile = personal.mobileNumber || personal.alternateMobileNumber || member.mobileNumber || member.phoneNumber || '';
      const firstName = personal.firstName || member.firstName || '';
      const middleName = personal.middleName || member.middleName || '';
      const lastName = personal.lastName || member.lastName || '';
      const composedName = member.name || `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();

      return {
        serNo: member.serNo ?? personal.serNo ?? null,
        firstName,
        middleName,
        lastName,
        name: composedName,
        email: personal.email || member.email || '',
        mobileNumber: mobile,
        dateOfBirth: personal.dateOfBirth || member.dateOfBirth || '',
        profileImage
      };
    });

    console.log(`[family] Search query="${query}" vansh=${vansh} found=${data.length}`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error searching members:', err);
    res.status(500).json({
      success: false,
      data: [],
      error: 'Failed to search members'
    });
  }
});

// Get all relationships (static relationships from database)
app.get('/api/family/all-relationships', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Get all members and extract relationships
    const members = await collection.find({}).toArray();
    const relationships = [];
    
    members.forEach(member => {
      // Add spouse relationships
      if (member.spouseSerNo) {
        relationships.push({
          fromSerNo: member.serNo,
          toSerNo: member.spouseSerNo,
          relation: 'Spouse',
          relationMarathi: 'पती/पत्नी'
        });
      }
      
      // Add parent-child relationships
      if (member.sonDaughterSerNo && Array.isArray(member.sonDaughterSerNo)) {
        member.sonDaughterSerNo.forEach(childSerNo => {
          relationships.push({
            fromSerNo: member.serNo,
            toSerNo: childSerNo,
            relation: 'Child',
            relationMarathi: 'मुल/मुलगी'
          });
        });
      }
      
      // Add father relationship
      if (member.fatherSerNo) {
        relationships.push({
          fromSerNo: member.fatherSerNo,
          toSerNo: member.serNo,
          relation: 'Child',
          relationMarathi: 'मुल/मुलगी'
        });
      }
    });
    
    console.log(`[family] Generated ${relationships.length} static relationships`);
    res.json(relationships);
  } catch (err) {
    console.error('Error fetching relationships:', err);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// Dynamic relations endpoint - calculates relationships dynamically
app.get('/api/family/dynamic-relations/:serNo', async (req, res) => {
  try {
    const { serNo } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Convert serNo to number
    const memberSerNo = parseInt(serNo);
    
    // Get the target member
    const targetMember = await collection.findOne({
      $or: [{ serNo: memberSerNo }, { serNo: String(memberSerNo) }]
    });
    
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Get all members for relationship calculation
    const allMembers = await collection.find({}).toArray();
    
    // Calculate dynamic relationships
    const dynamicRelations = [];
    
    allMembers.forEach(member => {
      if (member.serNo === targetMember.serNo) return; // Skip self
      
      const relation = calculateRelationship(targetMember, member, allMembers);
      if (relation) {
        dynamicRelations.push({
          related: member,
          relationEnglish: relation.english,
          relationMarathi: relation.marathi,
          relationshipPath: relation.path || []
        });
      }
    });
    
    console.log(`[family] Calculated ${dynamicRelations.length} dynamic relations for serNo ${serNo}`);
    res.json(dynamicRelations);
  } catch (err) {
    console.error('Error calculating dynamic relations:', err);
    res.status(500).json({ error: 'Failed to calculate dynamic relations' });
  }
});

// Helper function to calculate relationship between two members
function calculateRelationship(person1, person2, allMembers) {
  // Create a map for quick lookup
  const memberMap = new Map();
  allMembers.forEach(member => {
    memberMap.set(member.serNo, member);
  });
  
  // Direct relationships
  
  // Spouse
  if (person1.spouseSerNo === person2.serNo || person2.spouseSerNo === person1.serNo) {
    return { english: 'Spouse', marathi: 'पती/पत्नी' };
  }
  
  // Parent-Child
  if (person1.fatherSerNo === person2.serNo) {
    return { english: 'Father', marathi: 'वडील' };
  }
  if (person2.fatherSerNo === person1.serNo) {
    return { english: 'Son/Daughter', marathi: 'मुल/मुलगी' };
  }
  
  // Children
  if (person1.sonDaughterSerNo && person1.sonDaughterSerNo.includes(person2.serNo)) {
    return { english: 'Son/Daughter', marathi: 'मुल/मुलगी' };
  }
  if (person2.sonDaughterSerNo && person2.sonDaughterSerNo.includes(person1.serNo)) {
    return { english: 'Father/Mother', marathi: 'वडील/आई' };
  }
  
  // Siblings (same father)
  if (person1.fatherSerNo && person2.fatherSerNo && person1.fatherSerNo === person2.fatherSerNo) {
    return { english: 'Sibling', marathi: 'भाऊ/बहीण' };
  }
  
  // Grandparent-Grandchild
  const person1Father = memberMap.get(person1.fatherSerNo);
  const person2Father = memberMap.get(person2.fatherSerNo);
  
  if (person1Father && person1Father.fatherSerNo === person2.serNo) {
    return { english: 'Grandfather', marathi: 'आजोबा' };
  }
  if (person2Father && person2Father.fatherSerNo === person1.serNo) {
    return { english: 'Grandson/Granddaughter', marathi: 'नातू/नात' };
  }
  
  // Uncle-Nephew/Niece
  if (person1Father && person2.fatherSerNo === person1Father.serNo) {
    return { english: 'Uncle/Aunt', marathi: 'काका/मावशी' };
  }
  if (person2Father && person1.fatherSerNo === person2Father.serNo) {
    return { english: 'Nephew/Niece', marathi: 'पुतणा/पुतणी' };
  }
  
  // Cousins (same grandfather)
  if (person1Father && person2Father && 
      person1Father.fatherSerNo && person2Father.fatherSerNo &&
      person1Father.fatherSerNo === person2Father.fatherSerNo) {
    return { english: 'Cousin', marathi: 'चुलत भाऊ/बहीण' };
  }
  
  // If no direct relationship found, return null
  return null;
}

// DBA CRUD Operations for Family Members
// Get all family members (DBA only)
app.get('/api/dba/family-members', verifyToken, requireDBA, async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    const members = await collection.find({}).toArray();
    res.json({ members });
  } catch (err) {
    console.error('Error fetching family members:', err);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// Create new family member (DBA only)
app.post('/api/dba/family-members', verifyToken, requireDBA, async (req, res) => {
  try {
    // Accept flat dot-notated keys from the frontend and nest them
    const memberData = nestObject(req.body);
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Add timestamps
    memberData.createdAt = new Date();
    memberData.updatedAt = new Date();
    
    const result = await collection.insertOne(memberData);
    res.status(201).json({ 
      message: 'Family member created successfully',
      member: { ...memberData, _id: result.insertedId }
    });
  } catch (err) {
    console.error('Error creating family member:', err);
    res.status(500).json({ error: 'Failed to create family member' });
  }
});

// Update family member (DBA only)
app.put('/api/dba/family-members/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Add update timestamp
    updateData.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { _id: new (await import('mongodb')).ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    
    res.json({ message: 'Family member updated successfully' });
  } catch (err) {
    console.error('Error updating family member:', err);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

// Delete family member (DBA only)
app.delete('/api/dba/family-members/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const result = await collection.deleteOne({ _id: new (await import('mongodb')).ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    
    res.json({ message: 'Family member deleted successfully' });
  } catch (err) {
    console.error('Error deleting family member:', err);
    res.status(500).json({ error: 'Failed to delete family member' });
  }
});

// Get family member by ID (DBA only)
app.get('/api/dba/family-members/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const member = await collection.findOne({ _id: new (await import('mongodb')).ObjectId(id) });
    
    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    
    res.json({ member });
  } catch (err) {
    console.error('Error fetching family member:', err);
    res.status(500).json({ error: 'Failed to fetch family member' });
  }
});

// Test endpoint to check if API is working
app.get('/api/dba/test', verifyToken, requireDBA, async (req, res) => {
  res.json({ message: 'DBA API is working', timestamp: new Date().toISOString() });
});

// Get member relationships (DBA only)
app.get('/api/dba/member-relationships/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching relationships for member ID:', id);
    
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Try to find member by ObjectId first, then by string ID
    let member;
    try {
      member = await collection.findOne({ _id: new (await import('mongodb')).ObjectId(id) });
    } catch (objectIdError) {
      console.log('ObjectId conversion failed, trying string match:', objectIdError.message);
      member = await collection.findOne({ _id: id });
    }
    
    if (!member) {
      console.log('Member not found with ID:', id);
      return res.status(404).json({ error: 'Member not found' });
    }
    
    console.log('Found member:', member.name || member.firstName || 'Unknown');
    
    // Get all members for relationship calculation
    const allMembers = await collection.find({}).toArray();
    console.log('Total members in database:', allMembers.length);
    
    // Calculate relationships
    const relationships = [];
    
    allMembers.forEach(otherMember => {
      if (otherMember._id.toString() === member._id.toString()) return; // Skip self
      
      const relation = calculateRelationship(member, otherMember, allMembers);
      if (relation) {
        relationships.push({
          member: {
            id: otherMember._id,
            name: otherMember.name || (otherMember.firstName && otherMember.lastName ? `${otherMember.firstName} ${otherMember.lastName}` : otherMember.firstName || otherMember.lastName || 'Unknown'),
            status: otherMember.status || 'Unknown'
          },
          relationEnglish: relation.english,
          relationMarathi: relation.marathi
        });
      }
    });
    
    console.log('Found relationships:', relationships.length);
    
    res.json({
      member: {
        id: member._id,
        name: member.name || (member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || member.lastName || 'Unknown'),
        status: member.status || 'Unknown'
      },
      relationships
    });
  } catch (err) {
    console.error('Error fetching member relationships:', err);
    res.status(500).json({ error: 'Failed to fetch member relationships', details: err.message });
  }
});

// Get database statistics (DBA only)
app.get('/api/dba/stats', verifyToken, requireDBA, async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const totalMembers = await collection.countDocuments();
    const livingMembers = await collection.countDocuments({ status: 'living' });
    const deceasedMembers = await collection.countDocuments({ status: 'deceased' });
    
    // Get recent additions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAdditions = await collection.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });
    
    res.json({
      totalMembers,
      livingMembers,
      deceasedMembers,
      recentAdditions
    });
  } catch (err) {
    console.error('Error fetching database stats:', err);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

// Simple test endpoint (no auth required)
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', createAuthRouter(connectToMongo));

// Admin routes
app.get('/api/admin/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const db = await connectToMongo();
    const familyCollection = db.collection(collectionName);
    
    // Get family member statistics
    const totalMembers = await familyCollection.countDocuments();
    const livingMembers = await familyCollection.countDocuments({ 
      $or: [
        { 'Death Date': { $exists: false } },
        { 'Death Date': null },
        { 'Death Date': '' }
      ]
    });
    const deceasedMembers = await familyCollection.countDocuments({ 
      'Death Date': { $exists: true, $ne: null, $ne: '' }
    });
    
    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAdditions = await familyCollection.countDocuments({
      'Registration Date': { $gte: thirtyDaysAgo }
    });

    res.json({
      totalMembers,
      livingMembers,
      deceasedMembers,
      recentAdditions,
      pendingApprovals: 4, // Mock data for admin panel
      approvedMembers: 3,
      rejectedRequests: 1
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// Admin family management routes
app.get('/api/admin/family-members', verifyToken, requireAdmin, async (req, res) => {
  try {
    const db = await connectToMongo();
    const familyCollection = db.collection(collectionName);
    
    const members = await familyCollection.find({}).toArray();
    res.json(members);
  } catch (err) {
    console.error('Error fetching family members:', err);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// Admin news management routes
app.get('/api/admin/news', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Mock news data for admin panel
    const news = [
      {
        id: 1,
        title: "GogateKulMandal Annual Meeting 2024",
        content: "Our kulamandal's annual meeting was successfully concluded.",
        author: "Narayan Shankar",
        category: "announcement",
        status: "published",
        createdAt: new Date().toISOString(),
        likes: 24,
        comments: 8
      }
    ];
    res.json(news);
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Hierarchical Family Tree Endpoint - Single Root Node (Fixed for nested schema)
app.get('/api/family/hierarchical-tree', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    const allMembers = await collection.find({}).toArray();
    
    console.log(`[HIERARCHICAL] Building single-root tree from ${allMembers.length} members`);
    
    // Helper function to get full name from nested structure
    function getFullName(member) {
      // Try nested schema first (newer format)
      if (member.personalDetails) {
        const first = member.personalDetails.firstName || '';
        const middle = member.personalDetails.middleName || '';
        const last = member.personalDetails.lastName || '';
        return `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
      }
      // Fallback to flat structure (older format)
      const first = member["First Name"] || member.firstName || '';
      const middle = member["Middle Name"] || member.middleName || '';
      const last = member["Last Name"] || member.lastName || '';
      return `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
    }

    // Helper function to get father's name from nested structure
    function getFatherName(member) {
      // Try nested schema first
      if (member.parentsInformation) {
        const first = member.parentsInformation.fatherFirstName || '';
        const middle = member.parentsInformation.fatherMiddleName || '';
        const last = member.parentsInformation.fatherLastName || '';
        return `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
      }
      // Fallback to flat structure
      const first = member["Father 's First Name "] || member["Father's First Name"] || '';
      const last = member["Father 's Last Name "] || member["Father's Last Name"] || '';
      return `${first} ${last}`.trim().replace(/\s+/g, ' ');
    }

    // Helper to get spouse name
    function getSpouseName(member) {
      if (member.marriedDetails) {
        const first = member.marriedDetails.spouseFirstName || '';
        const last = member.marriedDetails.spouseLastName || '';
        return `${first} ${last}`.trim().replace(/\s+/g, ' ');
      }
      return '';
    }

    // Helper to get gender
    function getGender(member) {
      if (member.personalDetails) return member.personalDetails.gender || 'Unknown';
      return member.Gender || 'Unknown';
    }

    // Create a map of all people by serNo (primary key)
    const memberMap = new Map();
    const childrenMap = new Map(); // Map of fatherSerNo to array of children
    
    allMembers.forEach(member => {
      if (member.serNo !== undefined && member.serNo !== null) {
        memberMap.set(member.serNo, member);
        
        // Build children map for faster lookups
        const fatherSerNo = member.fatherSerNo;
        if (fatherSerNo !== undefined && fatherSerNo !== null && fatherSerNo !== '') {
          if (!childrenMap.has(fatherSerNo)) {
            childrenMap.set(fatherSerNo, []);
          }
          childrenMap.get(fatherSerNo).push(member);
        }
      }
    });

    // Helper function to build tree node in CardFamilyTree format
    function buildTreeNode(member, processed = new Set()) {
      if (!member || processed.has(member.serNo)) {
        return null;
      }
      processed.add(member.serNo);

      const fullName = getFullName(member);
      const fatherSerNo = member.fatherSerNo;
      const spouseName = getSpouseName(member);

      // Get children - use pre-built map for O(1) lookup instead of O(n)
      const children = [];
      const memberChildren = childrenMap.get(member.serNo) || [];
      memberChildren.forEach(childMember => {
        if (!processed.has(childMember.serNo)) {
          const childNode = buildTreeNode(childMember, processed);
          if (childNode) children.push(childNode);
        }
      });

      return {
        name: fullName || `Member #${member.serNo}`,
        attributes: {
          serNo: member.serNo,
          gender: getGender(member),
          spouse: spouseName,
          vansh: member.vansh || '',
          dob: member.personalDetails?.dateOfBirth || member['Date of Birth'] || '',
          email: member.personalDetails?.email || member.Email || ''
        },
        children: children
      };
    }

    // Find root member (someone with no father or serNo 1)
    let rootMember = null;
    
    // First, try to find serNo 1 as root
    for (const member of allMembers) {
      if (member.serNo === 1 || member.serNo === '1') {
        rootMember = member;
        console.log(`[HIERARCHICAL] Using serNo 1 as root: ${getFullName(member)}`);
        break;
      }
    }

    // If no serNo 1, find someone with no father
    if (!rootMember) {
      for (const member of allMembers) {
        if (!member.fatherSerNo || member.fatherSerNo === null || member.fatherSerNo === '') {
          rootMember = member;
          console.log(`[HIERARCHICAL] Using natural root (no father): ${getFullName(member)}`);
          break;
        }
      }
    }

    // Build the tree
    let treeRoot = null;
    if (rootMember) {
      treeRoot = buildTreeNode(rootMember);
    }

    console.log(`[HIERARCHICAL] Tree built successfully. Root: ${rootMember ? getFullName(rootMember) : 'None'}`);

    res.json(treeRoot || {
      name: 'No Family Data',
      attributes: { serNo: 0, gender: 'Unknown', spouse: '', vansh: '' },
      children: []
    });
    
  } catch (err) {
    console.error('Error building single-root hierarchical tree:', err);
    res.status(500).json({ error: 'Failed to build hierarchical family tree' });
  }
});

// Family member registration endpoint - handles comprehensive family form
const uploadFields = upload.fields([
  { name: "personalDetails.profileImage", maxCount: 1 },
  { name: "divorcedDetails.spouseProfileImage", maxCount: 1 },
  { name: "marriedDetails.spouseProfileImage", maxCount: 1 },
  { name: "remarriedDetails.spouseProfileImage", maxCount: 1 },
  { name: "widowedDetails.spouseProfileImage", maxCount: 1 },
  { name: "parentsInformation.fatherProfileImage", maxCount: 1 },
  { name: "parentsInformation.motherProfileImage", maxCount: 1 },
]);

app.post('/api/family/register', uploadFields, parseNestedFields, async (req, res) => {
  try {
    console.log('📥 POST /api/family/register - Family member registration received');
    
    const database = await connectToMongo();
    const collectionName = 'Heirarchy_form'; // Use the form-gkm collection
    const collection = database.collection(collectionName);

    // Convert uploaded files to base64
    const filesData = {};
    if (req.files) {
      Object.entries(req.files).forEach(([fieldPath, files]) => {
        const parsed = fieldPath.split('.');
        const property = parsed.pop();
        const parentPath = parsed.join('.');

        filesData[parentPath] = filesData[parentPath] || {};
        if (files && files.length > 0) {
          const file = files[0];
          filesData[parentPath][property] = {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype,
            originalName: file.originalname,
          };
        }
      });
    }

    // Merge file data into body
    const mergeData = (base, updates) => {
      const result = Array.isArray(base) ? [...base] : { ...base };
      Object.keys(updates).forEach((key) => {
        if (updates[key] && typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
          const existingValue = base?.[key] && typeof base[key] === 'object' ? base[key] : {};
          result[key] = mergeData(existingValue, updates[key]);
        } else {
          result[key] = updates[key];
        }
      });
      return result;
    };

    let payload = req.body;
    if (Object.keys(filesData).length > 0) {
      Object.keys(filesData).forEach((key) => {
        const keys = key.split('.');
        let pointer = payload;
        keys.forEach((k, index) => {
          if (index === keys.length - 1) {
            pointer[k] = mergeData(pointer[k] || {}, filesData[key]);
          } else {
            if (!pointer[k]) pointer[k] = {};
            pointer = pointer[k];
          }
        });
      });
    }

  // Ensure dotted keys are nested correctly
  payload = nestObject(payload);

  // Add timestamp
  payload.createdAt = new Date();
  payload.updatedAt = new Date();

    // Insert the family member
    const result = await collection.insertOne(payload);
    
    console.log(`✅ Family member registered successfully with ID: ${result.insertedId}`);
    res.status(201).json({
      message: 'Family member registered successfully',
      memberId: result.insertedId,
    });
  } catch (err) {
    console.error('❌ Error registering family member:', err);
    res.status(500).json({ error: 'Failed to register family member', details: err.message });
  }
});

// Search parents endpoint for autocomplete
app.get('/api/family/search', async (req, res) => {
  try {
    const { query, vansh } = req.query;
    
    if (!query || !vansh) {
      return res.json({ success: false, data: [] });
    }

    const database = await connectToMongo();
    const collection = database.collection('members'); // Search in main members collection
    
    // Create search regex for flexible matching
    const searchRegex = new RegExp(query, 'i');
    
    const members = await collection.find({
      vansh: parseInt(vansh),
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { 'name': searchRegex }
      ]
    }).limit(10).toArray();

    res.json({
      success: true,
      data: members.map(m => ({
        serNo: m.serNo,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        mobileNumber: m.mobileNumber,
        dateOfBirth: m.dateOfBirth,
      }))
    });
  } catch (err) {
    console.error('Error searching parents:', err);
    res.json({ success: false, data: [], error: err.message });
  }
});

// Family member registration endpoint - accepts multipart form data with images
app.post('/api/family/add', upload.any(), parseNestedFields, async (req, res) => {
  try {
    const parsedData = req.parsedFields || req.body;
    
    const database = await connectToMongo();
    const collection = database.collection('Heirarchy_form');
    
    // Process images - convert to base64 with MIME type
    const processedData = { ...parsedData };
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fieldName = file.fieldname;
        const base64Data = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        
        // Store as object with data and mimeType for proper reconstruction
        processedData[fieldName] = {
          data: base64Data,
          mimeType: mimeType,
          filename: file.originalname
        };
      });
    }
    
  // Ensure dotted keys are nested correctly
  const processedNested = nestObject(processedData);

  // Add timestamps
  processedNested.createdAt = new Date();
  processedNested.updatedAt = new Date();
    
    const result = await collection.insertOne(processedNested);
    
    res.json({
      success: true,
      message: 'Family member registered successfully!',
      id: result.insertedId,
      data: processedNested
    });
  } catch (err) {
    console.error('Error registering family member:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to register family member: ' + err.message
    });
  }
});

// Example Mongoose-backed create route that demonstrates using await new Model(formattedData).save()
app.post('/api/dba/family-members-mongoose', verifyToken, requireDBA, async (req, res) => {
  try {
    // Convert flat dotted keys into nested objects
    const formatted = nestObject(req.body || {});

    // Use the permissive Member model we initialized above
    const Member = mongoose.models.Member;
    if (!Member) {
      return res.status(500).json({ error: 'Mongoose Member model not initialized' });
    }

    const member = new Member(formatted);
    const saved = await member.save();

    res.status(201).json({ message: 'Member saved via Mongoose', member: saved });
  } catch (err) {
    console.error('Error saving member via Mongoose:', err);
    res.status(500).json({ error: 'Failed to save member via Mongoose', details: err.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Test endpoint: http://localhost:${port}/api/test`);
});


