const PdfPrinter = require('pdfmake');

// Use core fonts that do not require embedding TTF files.
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

function getPrinter() {
  return new PdfPrinter(fonts);
}

function buildTableBody(headers, rows) {
  const body = [];
  // header row with style
  body.push(headers.map(h => ({ text: h, style: 'tableHeader' })));
  // data rows
  for (const row of rows) {
    body.push(row.map(cell => (cell === null || cell === undefined ? '' : String(cell))));
  }
  return body;
}

function buildDocDefinition({ type, title, columns, rows, footerSchool, createdAt }) {
  const body = buildTableBody(columns, rows);

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 50, 30, 50],
    header: {
      columns: [
        { text: title || `${type} Report`, style: 'header', alignment: 'left' },
        { text: new Date(createdAt || Date.now()).toLocaleString(), alignment: 'right', margin: [0, 3, 0, 0] },
      ],
      margin: [30, 20, 30, 0],
    },
    footer: function (currentPage, pageCount) {
      const left = footerSchool ? `School: ${footerSchool}` : '';
      const right = `Page ${currentPage} of ${pageCount}`;
      return {
        columns: [
          { text: left, alignment: 'left', margin: [30, 0, 0, 0] },
          { text: right, alignment: 'right', margin: [0, 0, 30, 0] },
        ],
        margin: [30, 0, 30, 20],
      };
    },
    content: [
      {
        table: {
          headerRows: 1,
          widths: Array(columns.length).fill('*'),
          body,
        },
        layout: {
          fillColor: function (rowIndex, node, columnIndex) {
            if (rowIndex === 0) return '#1F4E78';
            return rowIndex % 2 === 0 ? '#F7F9FC' : null;
          },
          hLineColor: function () {
            return '#E5E5E5';
          },
          vLineColor: function () {
            return '#E5E5E5';
          },
        },
      },
    ],
    styles: {
      header: { fontSize: 14, bold: true },
      tableHeader: { bold: true, color: '#FFFFFF', alignment: 'center' },
    },
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 9,
    },
  };

  return docDefinition;
}

async function buildPdfBuffer({ type, title, columns, rows, footerSchool, createdAt }) {
  try {
    const printer = getPrinter();
    const docDefinition = buildDocDefinition({ type, title, columns, rows, footerSchool, createdAt });
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err) => {
        console.error('PDF generation error:', err);
        reject(err);
      });
      pdfDoc.end();
    });
  } catch (err) {
    console.error('PDF build error:', err);
    throw err;
  }
}

module.exports = {
  buildPdfBuffer,
};
