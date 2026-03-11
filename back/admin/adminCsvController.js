/**
 * Admin API: list all CSV files under back/csv_files, grouped by user (folder).
 * GET /api/admin/csv-files
 * GET /api/admin/csv-files/download?userKey=xxx&path=relativePath
 */

const fs = require('fs');
const path = require('path');

const CSV_BASE_DIR = path.join(process.cwd(), 'csv_files');

function existsDir(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (e) {
    return false;
  }
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

/**
 * Recursively collect all .csv files under dir, return array of { relativePath, fullPath, size, mtime }.
 */
function collectCsvFiles(dir, baseDir, acc = []) {
  if (!existsDir(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(baseDir, full);
    if (ent.isDirectory()) {
      collectCsvFiles(full, baseDir, acc);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.csv')) {
      try {
        const stat = fs.statSync(full);
        acc.push({
          relativePath: rel.replace(/\\/g, '/'),
          filename: ent.name,
          size: stat.size,
          mtime: stat.mtime,
        });
      } catch (e) {
        // skip
      }
    }
  }
  return acc;
}

/**
 * GET /api/admin/csv-files
 * Returns { success, data: { users: [ { userKey, files: [ { relativePath, filename, size, mtime } ] } ] } }
 */
function getCsvFiles(req, res) {
  try {
    if (!existsDir(CSV_BASE_DIR)) {
      return res.json({ success: true, data: { users: [] } });
    }
    const userDirs = fs.readdirSync(CSV_BASE_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const users = [];
    for (const userKey of userDirs) {
      const userPath = path.join(CSV_BASE_DIR, userKey);
      const files = collectCsvFiles(userPath, userPath);
      users.push({ userKey, files });
    }
    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error('[Admin CSV] getCsvFiles error:', error);
    res.status(500).json({
      success: false,
      message: 'CSV 목록을 가져오는 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
}

/**
 * GET /api/admin/csv-files/download?userKey=xxx&path=relativePath
 * Admin only; path is relative to user folder (no ..).
 */
function downloadCsvFile(req, res) {
  try {
    const { userKey, path: relativePath } = req.query;
    if (!userKey || !relativePath) {
      return res.status(400).json({
        success: false,
        message: 'userKey와 path 쿼리 파라미터가 필요합니다.',
      });
    }
    const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const userDir = path.join(CSV_BASE_DIR, userKey);
    const fullPath = path.resolve(userDir, normalized);
    const userDirResolved = path.resolve(userDir);
    if (!fullPath.startsWith(userDirResolved + path.sep) && fullPath !== userDirResolved) {
      return res.status(400).json({ success: false, message: '잘못된 경로입니다.' });
    }
    if (!existsFile(fullPath)) {
      return res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
    }
    const filename = path.basename(fullPath);
    res.download(fullPath, filename);
  } catch (error) {
    console.error('[Admin CSV] download error:', error);
    res.status(500).json({
      success: false,
      message: '다운로드 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
}

module.exports = {
  getCsvFiles,
  downloadCsvFile,
};
