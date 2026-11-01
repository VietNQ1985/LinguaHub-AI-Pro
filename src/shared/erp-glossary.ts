export const ERP_GLOSSARY = [
  ['Microsoft Dynamics 365', 'Microsoft Dynamics 365'],
  ['financial dimensions', 'chiều tài chính'],
  ['general ledger', 'sổ cái'],
  ['vendor invoice', 'hóa đơn nhà cung cấp'],
  ['purchase order', 'đơn mua hàng'],
  ['sales order', 'đơn bán hàng'],
  ['data migration', 'chuyển đổi dữ liệu'],
  ['user acceptance testing', 'kiểm thử chấp nhận người dùng (UAT)'],
  ['UAT', 'kiểm thử chấp nhận người dùng'],
  ['go-live', 'chính thức vận hành'],
  ['deployment', 'triển khai'],
  ['sign-off', 'xác nhận/phê duyệt chính thức'],
  ['reconciliation', 'đối soát'],
  ['workflow', 'quy trình phê duyệt / luồng công việc'],
  ['inventory', 'hàng tồn kho'],
  ['customer service', 'dịch vụ khách hàng'],
  ['ERP implementation', 'triển khai hệ thống ERP'],
  ['financial accounting', 'kế toán tài chính'],
  ['project management', 'quản lý dự án'],
  ['SQL', 'ngôn ngữ truy vấn cơ sở dữ liệu SQL'],
  ['opening balance', 'số dư đầu kỳ'],
  ['cutover', 'chuyển đổi sang hệ thống mới tại thời điểm vận hành'],
  ['master data', 'dữ liệu danh mục'],
  ['chart of accounts', 'hệ thống tài khoản kế toán'],
  ['subledger', 'sổ kế toán chi tiết'],
] as const

export const ERP_GLOSSARY_PROMPT = ERP_GLOSSARY
  .map(([english, vietnamese]) => `${english}: ${vietnamese}`)
  .join('\n')
