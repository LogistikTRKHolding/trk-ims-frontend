import axios from 'axios';

// Cloudinary Configuration
const CLOUD_NAME = 'dhhqqxgaj';
const UPLOAD_PRESET = 'trk_inventory_preset'; // Ganti dengan preset name Anda

/**
 * Cloudinary Service
 * Handles image upload, optimization, and management
 */
export const cloudinaryService = {
  /**
   * Upload image to Cloudinary
   * @param {File} file - Image file from input
   * @returns {Promise<string>} - Cloudinary secure URL
   */
  uploadImage: async (file) => {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'trk-inventory/barang'); // Organize in folders

      // Upload to Cloudinary
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            console.log('Upload progress:', percentCompleted);
          },
        }
      );

      // Return secure URL (HTTPS)
      return response.data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      
      if (error.response) {
        // Cloudinary API error
        throw new Error(
          error.response.data?.error?.message || 'Failed to upload image to Cloudinary'
        );
      } else if (error.request) {
        // Network error
        throw new Error('Network error. Please check your internet connection.');
      } else {
        // Other errors
        throw new Error('Failed to upload image: ' + error.message);
      }
    }
  },

  /**
   * Upload multiple images
   * @param {File[]} files - Array of image files
   * @returns {Promise<string[]>} - Array of Cloudinary URLs
   */
  uploadMultipleImages: async (files) => {
    try {
      const uploadPromises = files.map(file => cloudinaryService.uploadImage(file));
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      console.error('Multiple upload error:', error);
      throw error;
    }
  },

  /**
   * Delete image from Cloudinary
   * NOTE: This requires backend implementation with API secret
   * @param {string} publicId - Cloudinary public ID
   */
  deleteImage: async (publicId) => {
    console.warn('Image deletion should be implemented in backend with API secret');
    // This should be called via your backend API
    // Backend endpoint should use Cloudinary Admin API with API secret
    throw new Error('Delete operation must be done through backend API');
  },

  /**
   * Get optimized image URL with transformations
   * @param {string} url - Original Cloudinary URL
   * @param {object} options - Transformation options
   * @returns {string} - Transformed URL
   */
  getOptimizedUrl: (url, options = {}) => {
    if (!url || !url.includes('cloudinary.com')) return url;

    const {
      width = 800,
      height = 600,
      crop = 'fill',
      quality = 'auto',
      format = 'auto',
      gravity = 'auto',
    } = options;

    // Build transformation string
    const transformations = [
      `w_${width}`,
      `h_${height}`,
      `c_${crop}`,
      `q_${quality}`,
      `f_${format}`,
      `g_${gravity}`,
    ].join(',');

    // Insert transformations before /upload/
    return url.replace('/upload/', `/upload/${transformations}/`);
  },

  /**
   * Get thumbnail URL (150x150)
   * @param {string} url - Original Cloudinary URL
   * @returns {string} - Thumbnail URL
   */
  getThumbnailUrl: (url) => {
    return cloudinaryService.getOptimizedUrl(url, {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto',
    });
  },

  /**
   * Get medium-sized image URL (400x300)
   * @param {string} url - Original Cloudinary URL
   * @returns {string} - Medium URL
   */
  getMediumUrl: (url) => {
    return cloudinaryService.getOptimizedUrl(url, {
      width: 400,
      height: 300,
      crop: 'fill',
      quality: 'auto',
    });
  },

  /**
   * Get large image URL (800x600)
   * @param {string} url - Original Cloudinary URL
   * @returns {string} - Large URL
   */
  getLargeUrl: (url) => {
    return cloudinaryService.getOptimizedUrl(url, {
      width: 800,
      height: 600,
      crop: 'limit', // Don't upscale
      quality: 'auto',
    });
  },

  /**
   * Get public ID from Cloudinary URL
   * @param {string} url - Cloudinary URL
   * @returns {string} - Public ID
   */
  getPublicIdFromUrl: (url) => {
    if (!url || !url.includes('cloudinary.com')) return null;

    try {
      // Extract public ID from URL
      // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image.jpg
      // Public ID: folder/image
      const parts = url.split('/upload/');
      if (parts.length < 2) return null;

      const pathParts = parts[1].split('/');
      // Remove version (v1234567890) if exists
      const filteredParts = pathParts.filter(part => !part.startsWith('v'));
      
      // Remove file extension
      const publicId = filteredParts.join('/').replace(/\.[^/.]+$/, '');
      return publicId;
    } catch (error) {
      console.error('Error extracting public ID:', error);
      return null;
    }
  },

  /**
   * Validate image file
   * @param {File} file - File to validate
   * @returns {object} - { valid: boolean, error: string }
   */
  validateImage: (file) => {
    // Check if file exists
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP.' 
      };
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: 'File size must be less than 5MB' 
      };
    }

    return { valid: true, error: null };
  },

  /**
   * Compress image before upload (client-side)
   * @param {File} file - Image file
   * @param {number} maxWidth - Max width
   * @param {number} maxHeight - Max height
   * @param {number} quality - JPEG quality (0-1)
   * @returns {Promise<Blob>} - Compressed image blob
   */
  compressImage: (file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            file.type,
            quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },
};

export default cloudinaryService;