const ExcelJS = require('exceljs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'file/lendon.upos.xlsx');
const ORDER_SHEET_NAME = 'Đơn hàng';
const ORDER_DATA_START_ROW = 6;
const DELIVERY_NOTE = 'CHO KIỂM TRA HÀNG K NHẬN THU 30K SHIP';

function fillOrderRow(worksheet, rowNumber, order) {
  worksheet.getCell(`A${rowNumber}`).value = '';
  worksheet.getCell(`B${rowNumber}`).value = order.customer_name || '';
  worksheet.getCell(`C${rowNumber}`).value = order.phone || '';
  worksheet.getCell(`D${rowNumber}`).value = order.address || '';
  worksheet.getCell(`H${rowNumber}`).value = order.product_name || '';
  worksheet.getCell(`J${rowNumber}`).value = Number(order.note) || 0;
  worksheet.getCell(`K${rowNumber}`).value = 1;
  worksheet.getCell(`O${rowNumber}`).value = 1;
  worksheet.getCell(`Q${rowNumber}`).value = DELIVERY_NOTE;
}

function clearTemplateDataRows(worksheet, startRow) {
  if (worksheet.rowCount < startRow) {
    return;
  }

  for (let rowNumber = worksheet.rowCount; rowNumber >= startRow; rowNumber -= 1) {
    worksheet.spliceRows(rowNumber, 1);
  }
}

async function buildOrdersExcelBuffer(orders) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const orderSheet = workbook.getWorksheet(ORDER_SHEET_NAME) || workbook.worksheets[0];

  if (!orderSheet) {
    throw new Error('Không tìm thấy sheet đơn hàng trong file mẫu');
  }

  clearTemplateDataRows(orderSheet, ORDER_DATA_START_ROW);
  orders.forEach((order, index) => {
    fillOrderRow(orderSheet, ORDER_DATA_START_ROW + index, order);
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildOrdersExcelBuffer,
};
