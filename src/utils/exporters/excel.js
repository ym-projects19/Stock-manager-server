const ExcelJS = require('exceljs');

function autoSizeColumns(worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      const columnLength = val === null || val === undefined
        ? 0
        : typeof val === 'object' && val.richText
          ? val.richText.map(rt => rt.text).join('').length
          : String(val).length;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, 12), 50);
  });
}

function addTableHeader(ws, headers) {
  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    };
  });
  headerRow.height = 22;
}

function styleTableBody(ws, startRow) {
  const lastRow = ws.lastRow.number;
  for (let r = startRow; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const isZebra = r % 2 === 0;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        left: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        right: { style: 'thin', color: { argb: 'FFE5E5E5' } },
      };
      cell.alignment = { vertical: 'middle' };
      if (isZebra) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF7F9FC' },
        };
      }
    });
    row.height = 18;
  }
}

function formatColumns(ws, formats = {}) {
  Object.entries(formats).forEach(([colIndex, numFmt]) => {
    ws.getColumn(parseInt(colIndex, 10)).numFmt = numFmt;
  });
}

async function buildWorkbook({ type, title, columns, rows, numberFormats = {}, createdAt }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Reports Service';
  workbook.created = new Date(createdAt || Date.now());

  const ws = workbook.addWorksheet(title || 'Report', {
    properties: { defaultRowHeight: 18 },
    pageSetup: { fitToPage: true, fitToHeight: 1, fitToWidth: 1, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5 } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  addTableHeader(ws, columns);

  rows.forEach((row) => {
    ws.addRow(row);
  });

  styleTableBody(ws, 2);
  formatColumns(ws, numberFormats);
  autoSizeColumns(ws);

  // Add a top title row merged across columns
  const titleText = title || `${type} Report`;
  ws.insertRow(1, [titleText]);
  ws.mergeCells(1, 1, 1, columns.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE9EEF6' },
  };
  ws.getRow(1).height = 24;

  // Shift header styles down by one since we inserted title
  const headerRow = ws.getRow(2);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    };
  });

  // Return as buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  buildWorkbook,
};
