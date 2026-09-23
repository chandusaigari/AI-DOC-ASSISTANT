const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdfPoppler = require('pdf-poppler');
const documentImageModel = require('../models/documentImageModel');

const UPLOADS_IMAGE_DIR = path.join(__dirname, '../uploads/images');

const imageExtractorService = {
  async extractAndSaveImages(documentId, userId, filePath, fileType) {
    const docImageDir = path.join(UPLOADS_IMAGE_DIR, String(documentId));
    if (!fs.existsSync(docImageDir)) {
      fs.mkdirSync(docImageDir, { recursive: true });
    }

    const ext = (fileType || path.extname(filePath)).toLowerCase();

    if (ext.includes('doc')) {
      return await this.extractDocxImages(documentId, userId, filePath, docImageDir);
    } else if (ext.includes('pdf')) {
      return await this.extractPdfImages(documentId, userId, filePath, docImageDir);
    }

    return [];
  },

  async extractDocxImages(documentId, userId, filePath, outputDir) {
    const extractedImages = [];
    let imageCounter = 0;
    let paragraphCounter = 0;
    let currentVirtualPage = 1;

    try {
      await mammoth.convertToHtml(
        { path: filePath },
        {
          transformDocument: (element) => {
            if (element.type === 'paragraph') {
              paragraphCounter++;
              currentVirtualPage = Math.floor(paragraphCounter / 5) + 1;
            }
            return element;
          },
          convertImage: mammoth.images.imgElement(async (element) => {
            try {
              imageCounter++;
              const imageBuffer = await element.read();
              if (!imageBuffer || imageBuffer.length === 0) return {};

              const mimeType = element.contentType || 'image/png';
              let extension = 'png';
              if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
              else if (mimeType.includes('gif')) extension = 'gif';
              else if (mimeType.includes('svg')) extension = 'svg';

              const filename = `docx_img_${Date.now()}_${imageCounter}.${extension}`;
              const savePath = path.join(outputDir, filename);

              fs.writeFileSync(savePath, imageBuffer);

              const assignedPage = currentVirtualPage > 0 ? currentVirtualPage : null;
              const imageId = await documentImageModel.create({
                documentId,
                userId,
                page: assignedPage,
                filePath: savePath,
                width: null,
                height: null
              });

              const imageRecord = {
                id: imageId,
                documentId,
                userId,
                page: assignedPage,
                filePath: savePath,
                filename
              };
              extractedImages.push(imageRecord);

              return { src: `/api/documents/images/${imageId}` };
            } catch (err) {
              console.warn(`[DOCX Image Extractor Warning] Failed to process image #${imageCounter}:`, err.message);
              return {};
            }
          })
        }
      );

      console.log(`[DOCX Image Extractor] Successfully extracted ${extractedImages.length} images for Document #${documentId}`);
      return extractedImages;
    } catch (err) {
      console.warn(`[DOCX Image Extractor Warning] Error processing DOCX images for Document #${documentId}:`, err.message);
      return [];
    }
  },

  async extractPdfImages(documentId, userId, filePath, outputDir) {
    const extractedImages = [];
    try {
      console.log(`[PDF Image Extractor] Attempting PDF image extraction for Document #${documentId}...`);
      
      const opts = {
        format: 'png',
        out_dir: outputDir,
        out_prefix: `pdf_p`,
        page: null
      };

      await pdfPoppler.convert(filePath, opts);

      // Read output images from directory
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        if (file.startsWith('pdf_p') && (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))) {
          const fullPath = path.join(outputDir, file);
          
          // Extract page number from filename e.g. pdf_p-1.png or pdf_p-01.png
          const pageMatch = file.match(/pdf_p-?(\d+)/i);
          const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : null;

          const imageId = await documentImageModel.create({
            documentId,
            userId,
            page: pageNum,
            filePath: fullPath,
            width: null,
            height: null
          });

          extractedImages.push({
            id: imageId,
            documentId,
            userId,
            page: pageNum,
            filePath: fullPath,
            filename: file
          });
        }
      }

      console.log(`[PDF Image Extractor] Successfully extracted ${extractedImages.length} PDF images/pages for Document #${documentId}`);
      return extractedImages;
    } catch (err) {
      console.warn(
        `[PDF Image Extractor Warning] PDF image extraction skipped for Document #${documentId}: ${err.message}. ` +
        `Note: To enable PDF image extraction, install Poppler (e.g. pdftocairo/pdfimages). Text extraction and RAG search will continue normally.`
      );
      return [];
    }
  },

  deleteDocumentImages(documentId) {
    try {
      const docImageDir = path.join(UPLOADS_IMAGE_DIR, String(documentId));
      if (fs.existsSync(docImageDir)) {
        fs.rmSync(docImageDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`[Image Clean Cleanup Warning] Failed to delete image directory for doc ${documentId}:`, err.message);
    }
  }
};

module.exports = imageExtractorService;
