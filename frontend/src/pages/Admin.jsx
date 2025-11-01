import React, { useState, useEffect } from 'react';
import { Check, X, User, Calendar, Mail, Phone, MapPin, FileText, Shield, Bell, Search, Clock, AlertCircle, Eye, UserCheck, UserX, RefreshCw } from 'lucide-react';
import axios from 'axios';

// Recursive component to render MongoDB document fields
const RenderField = ({ fieldKey, value, level }) => {
  const indent = level * 20;
  
  // Format field key to be more readable
  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  };

  // Determine the type and render accordingly
  const renderValue = () => {
    // Null or undefined
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }

    // Boolean
    if (typeof value === 'boolean') {
      return (
        <span className={`px-2 py-1 rounded text-sm font-semibold ${
          value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {value.toString()}
        </span>
      );
    }

    // Number
    if (typeof value === 'number') {
      return <span className="text-blue-600 font-mono">{value}</span>;
    }

    // Date string
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return (
        <span className="text-purple-600">
          {new Date(value).toLocaleString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      );
    }

    // String
    if (typeof value === 'string') {
      return <span className="text-gray-800">{value || <span className="text-gray-400 italic">empty</span>}</span>;
    }

    // Array
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">empty array</span>;
      }
      return (
        <div className="mt-2 space-y-2">
          {value.map((item, index) => (
            <div key={index} className="ml-6 p-3 bg-gray-50 rounded-lg border-l-2 border-orange-300">
              <span className="text-xs font-semibold text-gray-500 mr-2">[{index}]</span>
              {typeof item === 'object' && item !== null ? (
                <div className="mt-2 space-y-2">
                  {Object.entries(item).map(([subKey, subValue]) => (
                    <RenderField key={subKey} fieldKey={subKey} value={subValue} level={level + 2} />
                  ))}
                </div>
              ) : (
                <span className="text-gray-800">{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Object (nested document)
    if (typeof value === 'object') {
      return (
        <div className="mt-2 ml-4 space-y-2 p-4 bg-gradient-to-r from-gray-50 to-orange-50 rounded-lg border border-gray-200">
          {Object.entries(value).map(([subKey, subValue]) => (
            <RenderField key={subKey} fieldKey={subKey} value={subValue} level={level + 1} />
          ))}
        </div>
      );
    }

    return <span className="text-gray-600">{String(value)}</span>;
  };

  return (
    <div className="py-2 border-b border-gray-100 last:border-b-0" style={{ paddingLeft: `${indent}px` }}>
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-3">
          <span className="text-sm font-bold text-gray-700 min-w-[200px] pt-1">
            {formatKey(fieldKey)}:
          </span>
          <div className="flex-1">
            {renderValue()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple component to display a single data field
const DataField = ({ label, value }) => {
  // Format the label to be more readable
  const formatLabel = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  };

  // Format the value for display
  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-gray-400 italic">Not provided</span>;
    }
    
    if (typeof val === 'boolean') {
      return (
        <span className={`px-2 py-1 rounded text-sm font-semibold ${
          val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    }
    
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      return new Date(val).toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    
    return String(val);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {formatLabel(label)}
      </label>
      <div className="text-base text-slate-900 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
        {formatValue(value)}
      </div>
    </div>
  );
};

const GogteKulAdmin = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectedMembers, setRejectedMembers] = useState([]);
  const [showConfirmReject, setShowConfirmReject] = useState(false);
  const [pendingRejection, setPendingRejection] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Reset to page 1 when tab changes or search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Fetch registrations from server
  useEffect(() => {
    fetchRegistrations();
    fetchRejectedMembers();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      // Call the form-gkm server (port 5000) for registrations
      const response = await axios.get('http://localhost:5000/api/family/registrations');
      console.log('✅ API Response:', response.data);
      if (response.data.success) {
        console.log('📊 Registrations data:', response.data.data);
        console.log('📊 Number of registrations:', response.data.data.length);
        setRegistrations(response.data.data);
      }
    } catch (err) {
      console.error('❌ Error fetching registrations:', err);
      setError('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const fetchRejectedMembers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/family/rejected');
      if (response.data.success) {
        console.log('📊 Rejected members:', response.data.data.length);
        setRejectedMembers(response.data.data);
      }
    } catch (err) {
      console.error('❌ Error fetching rejected members:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRegistrations();
    await fetchRejectedMembers();
    setRefreshing(false);
  };

  // Filter registrations by status
  // Treat records without status as 'pending' (for backwards compatibility)
  const allPendingRegistrations = registrations.filter(r => !r.status || r.status === 'pending' || r.status === 'under_review');
  const allApprovedMembers = registrations.filter(r => r.status === 'approved');
  const rejectedRequests = registrations.filter(r => r.status === 'rejected');

  // Search filter function
  const filterBySearch = (items) => {
    if (!searchTerm.trim()) return items;
    
    const searchLower = searchTerm.toLowerCase();
    return items.filter(item => {
      const pd = item.personalDetails || {};
      const pi = item.parentsInformation || {};
      const spouse = item.spouseInformation || {};
      
      // Search in personal details
      const firstName = (pd.firstName || '').toLowerCase();
      const middleName = (pd.middleName || '').toLowerCase();
      const lastName = (pd.lastName || '').toLowerCase();
      const fullName = `${firstName} ${middleName} ${lastName}`.trim();
      const email = (pd.email || '').toLowerCase();
      const phone = (pd.phoneNumber || '').toLowerCase();
      const city = (pd.city || '').toLowerCase();
      const state = (pd.state || '').toLowerCase();
      
      // Search in parents information
      const fatherName = `${pi.fatherFirstName || ''} ${pi.fatherLastName || ''}`.toLowerCase();
      const motherName = `${pi.motherFirstName || ''} ${pi.motherLastName || ''}`.toLowerCase();
      
      // Search in spouse information
      const spouseName = `${spouse.spouseFirstName || ''} ${spouse.spouseLastName || ''}`.toLowerCase();
      
      // Search in relation to parent
      const relation = (pi.relationToParent || '').toLowerCase();
      
      return fullName.includes(searchLower) ||
             firstName.includes(searchLower) ||
             lastName.includes(searchLower) ||
             email.includes(searchLower) ||
             phone.includes(searchLower) ||
             city.includes(searchLower) ||
             state.includes(searchLower) ||
             fatherName.includes(searchLower) ||
             motherName.includes(searchLower) ||
             spouseName.includes(searchLower) ||
             relation.includes(searchLower);
    });
  };

  // Apply search filter
  const pendingRegistrations = filterBySearch(allPendingRegistrations);
  const approvedMembers = filterBySearch(allApprovedMembers);
  const filteredRejectedMembers = filterBySearch(rejectedMembers);

  // Pagination logic
  const getCurrentPageData = (data) => {
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    return data.slice(indexOfFirstRecord, indexOfLastRecord);
  };

  const getTotalPages = (data) => {
    return Math.ceil(data.length / recordsPerPage);
  };

  // Get paginated data based on active tab
  const paginatedPendingRegistrations = getCurrentPageData(pendingRegistrations);
  const paginatedApprovedMembers = getCurrentPageData(approvedMembers);
  const paginatedRejectedMembers = getCurrentPageData(filteredRejectedMembers);

  // Pagination handlers
  const handleNextPage = () => {
    const totalPages = activeTab === 'pending' 
      ? getTotalPages(pendingRegistrations)
      : activeTab === 'approved'
      ? getTotalPages(approvedMembers)
      : getTotalPages(filteredRejectedMembers);
    
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageClick = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Debug logging only when registrations change
  useEffect(() => {
    if (registrations.length > 0) {
      console.log('🔍 All registrations:', registrations.length);
      console.log('⏳ Pending:', allPendingRegistrations.length);
      console.log('✅ Approved:', allApprovedMembers.length);
      console.log('❌ Rejected:', rejectedRequests.length);
      console.log('📋 Sample registration:', registrations[0]);
    }
  }, [registrations.length, allPendingRegistrations.length, allApprovedMembers.length, rejectedRequests.length, registrations]);

  const handleApprove = async (id, applicantData) => {
    setApprovalAction({ type: 'approve', id, data: applicantData });
    setShowApprovalModal(true);
  };

  const handleReject = async (id, applicantData) => {
    // Show first confirmation
    setPendingRejection({ id, data: applicantData });
    setShowConfirmReject(true);
  };

  const confirmReject = () => {
    // Close first confirmation and show second
    setShowConfirmReject(false);
    if (pendingRejection) {
      setApprovalAction({ type: 'reject', id: pendingRejection.id, data: pendingRejection.data });
      setShowApprovalModal(true);
      setPendingRejection(null);
    }
  };

  const confirmAction = async () => {
    if (!approvalAction) return;

    const actionType = approvalAction.type;
    const status = actionType === 'approve' ? 'approved' : 'rejected';
    const recordId = approvalAction.id;
    
    // Close the approval modal immediately
    setShowApprovalModal(false);
    
    // Remove the record from the list immediately for better UX
    setRegistrations(prev => prev.filter(reg => reg._id !== recordId));
    
    // Show processing/loading state
    setIsProcessing(true);

    try {
      console.log('🔄 Sending request to update status:', { id: recordId, status });
      
      // Call the form-gkm server (port 5000) for status updates
      const response = await axios.patch(`http://localhost:5000/api/family/registrations/${recordId}/status`, {
        status,
        adminNotes: approvalAction.notes || ''
      });

      console.log('📥 Received response:', response.data);

      if (response.data.success) {
        console.log('✅ Status update successful');
        console.log(`✅ ${status} registration:`, recordId);
        
        // Hide processing
        setIsProcessing(false);
        
        // Show success popup
        setSuccessMessage(status === 'approved' ? 'Registration Approved!' : 'Registration Deleted Successfully!');
        setShowSuccessModal(true);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          setShowSuccessModal(false);
        }, 3000);
      } else {
        // If failed, restore the record
        setIsProcessing(false);
        await fetchRegistrations();
        alert(`Failed to ${actionType} registration: ${response.data.message}`);
      }
    } catch (err) {
      console.error('❌ Error updating registration:', err);
      console.error('❌ Error response:', err.response?.data);
      
      // Hide processing
      setIsProcessing(false);
      
      // If failed, restore the record
      await fetchRegistrations();
      
      // Show error
      alert(`Failed to update registration status: ${err.response?.data?.message || err.message}`);
    } finally {
      setApprovalAction(null);
    }
  };

  const toggleMemberSelection = (id) => {
    setSelectedMembers(prev => 
      prev.includes(id) 
        ? prev.filter(memberId => memberId !== id)
        : [...prev, id]
    );
  };

  const handleBulkAction = (action) => {
    console.log(`Bulk ${action}:`, selectedMembers);
    setSelectedMembers([]);
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date'; // Fallback for invalid dates
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Helper function to get full name from registration
  const getFullName = (registration) => {
    const pd = registration.personalDetails;
    if (!pd) return 'Unknown';
    return `${pd.firstName || ''} ${pd.middleName || ''} ${pd.lastName || ''}`.trim();
  };

  // Helper function to get parent name
  const getParentName = (registration) => {
    const pi = registration.parentsInformation;
    if (!pi) return 'N/A';
    return `${pi.fatherFirstName || ''} ${pi.fatherLastName || ''}`.trim() || 
           `${pi.motherFirstName || ''} ${pi.motherLastName || ''}`.trim() || 
           'N/A';
  };

  // Helper to get full address
  const getAddress = (registration) => {
    const pd = registration.personalDetails;
    if (!pd) return 'N/A';
    return `${pd.city || ''}, ${pd.state || ''}`.trim() || 'N/A';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff8f2] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          {/* Custom loading spinner */}
          <div className="relative flex flex-col items-center justify-center w-44 h-44">
            <span className="relative z-10 flex items-center justify-center w-32 h-32 rounded-full bg-white shadow-lg border-2 border-amber-100">
              <span className="absolute inset-0 w-full h-full rounded-full border-4 border-amber-500 border-t-transparent border-b-transparent animate-spin"></span>
              <img
                src="/axe.png"
                alt="Axe Icon"
                className="w-24 h-24 object-contain rounded-full shadow-md z-10"
                style={{ background: 'radial-gradient(circle at 60% 40%, #ffe0b2 60%, #fff8f2 100%)' }}
              />
            </span>
          </div>
          
          {/* Loading message */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl px-10 py-6 shadow-2xl border-2 border-orange-200">
            <p className="text-2xl font-bold text-center text-red-600 mb-2">
              Loading registrations...
            </p>
            <p className="text-base font-semibold text-center text-gray-800">
              This might take a moment. Please hold on!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-purple-600 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-xl">
          <p className="text-red-600 text-xl font-semibold">{error}</p>
          <button 
            onClick={fetchRegistrations}
            className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-purple-600">
      <div className="absolute inset-0 bg-black/10"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-300/20 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-orange-300/20 rounded-full blur-xl"></div>
      
      {/* Header */}
      <div className="relative bg-white/95 backdrop-blur-md shadow-xl border-b border-orange-200/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">GogateKulMandal Heritage</h1>
                <p className="text-gray-600">Family Registration Management System</p>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span>Admin Panel</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <div className="text-right">
                <p className="text-sm text-gray-600">Welcome back,</p>
                <p className="font-semibold text-gray-800">Heritage Administrator</p>
              </div>
              <Bell className="w-7 h-7 text-orange-600 cursor-pointer hover:text-orange-700 transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="relative max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 max-w-5xl mx-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border-2 border-orange-300/60 hover:shadow-3xl hover:scale-105 transition-all duration-300 transform">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 text-base font-semibold mb-2">Pending Requests</p>
                <p className="text-5xl font-bold text-orange-600 mb-2">{allPendingRegistrations.length}</p>
                <p className="text-sm text-orange-500 font-medium">Awaiting review</p>
              </div>
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl p-4 shadow-lg">
                <Clock className="w-14 h-14 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border-2 border-green-300/60 hover:shadow-3xl hover:scale-105 transition-all duration-300 transform">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 text-base font-semibold mb-2">Approved Members</p>
                <p className="text-5xl font-bold text-green-600 mb-2">{allApprovedMembers.length}</p>
                <p className="text-sm text-green-500 font-medium">Active members</p>
              </div>
              <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl p-4 shadow-lg">
                <UserCheck className="w-14 h-14 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border-2 border-purple-300/60 hover:shadow-3xl hover:scale-105 transition-all duration-300 transform">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 text-base font-semibold mb-2">Rejected</p>
                <p className="text-5xl font-bold text-purple-600 mb-2">{rejectedMembers.length}</p>
                <p className="text-sm text-purple-500 font-medium">All time</p>
              </div>
              <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl p-4 shadow-lg">
                <UserX className="w-14 h-14 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Management Panel */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-orange-200/50">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-0 px-6">
              {[
                { id: 'pending', label: 'Pending Requests', count: pendingRegistrations.length },
                { id: 'approved', label: 'Approved Members', count: approvedMembers.length },
                { id: 'rejected', label: 'Rejected', count: filteredRejectedMembers.length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-6 border-b-4 font-semibold text-sm transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {tab.label}
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Search and Controls */}
          <div className="p-6 border-b border-gray-200 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Name or email..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {selectedMembers.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleBulkAction('approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    Bulk Approve ({selectedMembers.length})
                  </button>
                  <button
                    onClick={() => handleBulkAction('reject')}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg"
                  >
                    <X className="w-4 h-4" />
                    Bulk Reject ({selectedMembers.length})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {activeTab === 'pending' && (
              <div className="space-y-6">
                {pendingRegistrations.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-xl font-semibold">
                      {searchTerm ? 'No pending registrations found' : 'No pending registrations'}
                    </p>
                    <p className="text-sm mt-2">
                      {searchTerm ? 'Try adjusting your search criteria' : 'All registrations have been reviewed'}
                    </p>
                  </div>
                ) : (
                  <>
                    {paginatedPendingRegistrations.map((request) => {
                    const fullName = getFullName(request);
                    const parentName = getParentName(request);
                    const address = getAddress(request);
                    const pd = request.personalDetails || {};

                    return (
                      <div
                        key={request._id}
                        className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-6 border-l-4 border-orange-500 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedMembers.includes(request._id)}
                              onChange={() => toggleMemberSelection(request._id)}
                              className="mt-2 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-4">
                                <h3 className="text-xl font-bold text-gray-800">{fullName}</h3>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                  request.status === 'under_review' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {request.status === 'under_review' ? 'Under Review' : 'Pending'}
                                </span>
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                                  Vansh {pd.vansh || 'N/A'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-700 mb-4">
                                <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
                                  <Mail className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">{pd.email || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
                                  <Phone className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">{pd.mobileNumber || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
                                  <MapPin className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">{address}</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
                                  <User className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">{pd.gender || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
                                  <Calendar className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">DOB: {formatDate(pd.dateOfBirth)}</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
                                  <FileText className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">Profession: {pd.profession || 'N/A'}</span>
                                </div>
                              </div>

                              <div className="bg-white/70 rounded-lg p-3 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="font-semibold text-gray-600">Parent:</span>
                                    <span className="ml-2 text-gray-800">{parentName}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-600">Marital Status:</span>
                                    <span className="ml-2 text-gray-800">{pd.everMarried === 'yes' ? 'Married' : 'Unmarried'}</span>
                                  </div>
                                  <div className="md:col-span-2">
                                    <span className="font-semibold text-gray-600">Submitted:</span>
                                    <span className="ml-2 text-gray-800">{formatDate(request.createdAt)}</span>
                                  </div>
                                </div>
                              </div>

                              {request.adminNotes && (
                                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
                                  <p className="text-sm text-blue-800">
                                    <strong>Admin Notes:</strong> {request.adminNotes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 ml-6">
                            <button
                              onClick={() => setSelectedRequest(request)}
                              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-medium flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            <button
                              onClick={() => handleApprove(request._id, request)}
                              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all font-medium flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(request._id, request)}
                              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-medium flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>
            )}

            {activeTab === 'approved' && (
              <div className="space-y-4">
                {approvedMembers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <UserCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-xl font-semibold">
                      {searchTerm ? 'No approved members found' : 'No approved members'}
                    </p>
                    <p className="text-sm mt-2">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Approve pending registrations to see them here'}
                    </p>
                  </div>
                ) : (
                  <>
                    {paginatedApprovedMembers.map((member) => {
                    const fullName = getFullName(member);
                    const pd = member.personalDetails || {};

                    return (
                      <div
                        key={member._id}
                        className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border-l-4 border-green-500 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-gray-800">{fullName}</h3>
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                Approved Member
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <Mail className="w-4 h-4 text-green-500" />
                                <span className="font-medium">{pd.email || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <User className="w-4 h-4 text-green-500" />
                                <span className="font-medium">{pd.gender || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <Calendar className="w-4 h-4 text-green-500" />
                                <span className="font-medium">Approved: {formatDate(member.reviewedAt)}</span>
                              </div>
                            </div>
                            <div className="mt-3 text-sm text-gray-600">
                              Vansh: <span className="font-semibold">{pd.vansh || 'N/A'}</span> | 
                              Phone: <span className="font-semibold ml-2">{pd.mobileNumber || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center gap-2">
                              <Check className="w-4 h-4" />
                              Active Member
                            </span>
                            <button 
                              onClick={() => setSelectedRequest(member)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>
            )}

            {activeTab === 'rejected' && (
              <div className="space-y-4">
                {filteredRejectedMembers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <UserX className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-xl font-semibold">
                      {searchTerm ? 'No rejected registrations found' : 'No rejected registrations'}
                    </p>
                    <p className="text-sm mt-2">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Rejected registrations will appear here'}
                    </p>
                  </div>
                ) : (
                  <>
                    {paginatedRejectedMembers.map((request) => {
                    const fullName = getFullName(request);
                    const pd = request.personalDetails || {};

                    return (
                      <div
                        key={request._id}
                        className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border-l-4 border-red-500 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-gray-800">{fullName}</h3>
                              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                Rejected
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 mb-3">
                              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <Mail className="w-4 h-4 text-red-500" />
                                <span className="font-medium">{pd.email || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <Calendar className="w-4 h-4 text-red-500" />
                                <span className="font-medium">Rejected: {formatDate(request.rejectedAt)}</span>
                              </div>
                            </div>
                            {request.adminNotes && (
                              <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg">
                                <p className="text-sm text-red-800">
                                  <strong>Reason:</strong> {request.adminNotes}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setSelectedRequest(request)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {activeTab === 'pending' && pendingRegistrations.length > 0 && (
            <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: getTotalPages(pendingRegistrations) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${
                        currentPage === page
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-orange-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === getTotalPages(pendingRegistrations)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === getTotalPages(pendingRegistrations)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {activeTab === 'approved' && approvedMembers.length > 0 && (
            <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: getTotalPages(approvedMembers) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${
                        currentPage === page
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-green-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === getTotalPages(approvedMembers)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === getTotalPages(approvedMembers)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {activeTab === 'rejected' && filteredRejectedMembers.length > 0 && (
            <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: getTotalPages(filteredRejectedMembers) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${
                        currentPage === page
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-purple-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === getTotalPages(filteredRejectedMembers)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === getTotalPages(filteredRejectedMembers)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Detail Modal - User Registration Details */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 p-8 border-b border-orange-200 bg-gradient-to-r from-orange-100 to-red-100 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">{getFullName(selectedRequest)}</h2>
                  <p className="text-gray-600">Registration Details</p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-3 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Personal Details Section */}
              {selectedRequest.personalDetails && (
                <div className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-slate-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">Personal Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(selectedRequest.personalDetails)
                      .filter(([key]) => !['profileImage', '__v'].includes(key))
                      .map(([key, value]) => (
                        <DataField key={key} label={key} value={value} />
                      ))}
                  </div>
                </div>
              )}

              {/* Parents Information Section */}
              {selectedRequest.parentsInformation && (
                <div className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-slate-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">Parents Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(selectedRequest.parentsInformation)
                      .filter(([key]) => !['fatherProfileImage', 'motherProfileImage', '__v'].includes(key))
                      .map(([key, value]) => (
                        <DataField key={key} label={key} value={value} />
                      ))}
                  </div>
                </div>
              )}

              {/* Spouse Information Section */}
              {selectedRequest.spouseInformation && Object.keys(selectedRequest.spouseInformation).length > 0 && (
                <div className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-slate-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">Spouse Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(selectedRequest.spouseInformation)
                      .filter(([key]) => !['profileImage', '__v'].includes(key))
                      .map(([key, value]) => (
                        <DataField key={key} label={key} value={value} />
                      ))}
                  </div>
                </div>
              )}

              {/* Children Information Section */}
              {selectedRequest.childrenInformation && selectedRequest.childrenInformation.length > 0 && (
                <div className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-slate-100">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">Children Information</h3>
                  {selectedRequest.childrenInformation.map((child, index) => (
                    <div key={index} className="mb-6 pb-6 border-b last:border-b-0 last:mb-0 last:pb-0">
                      <h4 className="text-lg font-semibold text-gray-700 mb-4">Child {index + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(child)
                          .filter(([key]) => !['_id', 'profileImage', '__v'].includes(key))
                          .map(([key, value]) => (
                            <DataField key={key} label={key} value={value} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Other Sections - Display any remaining fields */}
              {Object.entries(selectedRequest)
                .filter(([key]) => !['_id', 'createdAt', 'updatedAt', '__v', 'status', 'adminNotes', 'reviewedAt', 'personalDetails', 'parentsInformation', 'spouseInformation', 'childrenInformation'].includes(key))
                .map(([sectionKey, sectionValue]) => {
                  if (!sectionValue || (typeof sectionValue === 'object' && Object.keys(sectionValue).length === 0)) return null;
                  
                  return (
                    <div key={sectionKey} className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-slate-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">
                        {sectionKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </h3>
                      {typeof sectionValue === 'object' && !Array.isArray(sectionValue) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.entries(sectionValue)
                            .filter(([key]) => !['_id', '__v'].includes(key))
                            .map(([key, value]) => (
                              <DataField key={key} label={key} value={value} />
                            ))}
                        </div>
                      ) : Array.isArray(sectionValue) ? (
                        sectionValue.map((item, idx) => (
                          <div key={idx} className="mb-4 pb-4 border-b last:border-b-0 last:mb-0 last:pb-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {typeof item === 'object' ? (
                                Object.entries(item)
                                  .filter(([key]) => !['_id', '__v'].includes(key))
                                  .map(([key, value]) => (
                                    <DataField key={key} label={key} value={value} />
                                  ))
                              ) : (
                                <DataField label={`Item ${idx + 1}`} value={item} />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <DataField label={sectionKey} value={sectionValue} />
                      )}
                    </div>
                  );
                })
              }
            </div>
            
            <div className="p-8 border-t border-gray-200 bg-gray-50/50 flex gap-4 justify-end rounded-b-3xl">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-semibold transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleReject(selectedRequest.id, selectedRequest);
                  setSelectedRequest(null);
                }}
                className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-2 font-semibold transition-all"
              >
                <X className="w-5 h-5" />
                Reject Application
              </button>
              <button
                onClick={() => {
                  handleApprove(selectedRequest.id, selectedRequest);
                  setSelectedRequest(null);
                }}
                className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center gap-2 font-semibold transition-all"
              >
                <Check className="w-5 h-5" />
                Approve Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First Confirmation for Rejection */}
      {showConfirmReject && pendingRejection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-orange-100">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Are you sure you want to reject?
                </h3>
                <p className="text-gray-600">
                  This action will move the registration for{' '}
                  <span className="font-semibold">{getFullName(pendingRejection.data)}</span> to the rejected list.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmReject(false);
                    setPendingRejection(null);
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold transition-all"
                >
                  Yes, Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval/Rejection Modal */}
      {showApprovalModal && approvalAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  approvalAction.type === 'approve' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {approvalAction.type === 'approve' ? (
                    <Check className="w-8 h-8 text-green-600" />
                  ) : (
                    <X className="w-8 h-8 text-red-600" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {approvalAction.type === 'approve' ? 'Approve Registration' : 'Reject Registration'}
                </h3>
                <p className="text-gray-600">
                  Are you sure you want to {approvalAction.type} the registration for{' '}
                  <span className="font-semibold">{getFullName(approvalAction.data)}</span>?
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all ${
                    approvalAction.type === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {approvalAction.type === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing/Loading Modal */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl px-12 py-10 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xl font-semibold text-gray-800">Processing...</p>
              <p className="text-sm text-gray-600">Please wait while we update the registration</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-green-100">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-green-600">
                {successMessage}
              </h3>
              <p className="text-gray-600 mb-6">
                {successMessage.includes('Approved') 
                  ? 'The registration has been approved and moved to members collection.' 
                  : 'The registration has been deleted and moved to rejected members collection.'}
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-6 py-3 rounded-xl text-white font-semibold transition-all bg-green-600 hover:bg-green-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GogteKulAdmin;