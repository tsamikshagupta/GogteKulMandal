import React, { useEffect, useState } from 'react';
import CardFamilyTree from './CardFamilyTree';
import api from './utils/api';

const CardFamilyTreePage = () => {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHierarchicalTree = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/api/family/hierarchical-tree');
        setTreeData(response.data);
      } catch (err) {
        console.error('Error fetching hierarchical tree:', err);
        setError('Failed to load family tree. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchicalTree();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading family tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold text-lg mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            GogateKulMandal Family Tree
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore the GogateKulMandal family heritage through generations. Click on any family member to explore their profile.
          </p>
        </div>

        {/* Family Tree Container */}
        <div className="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
          {treeData && treeData.name && treeData.name !== 'No Family Data' ? (
            <CardFamilyTree data={treeData} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No family data available at the moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardFamilyTreePage;