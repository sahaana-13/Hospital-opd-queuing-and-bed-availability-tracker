export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  next();
};
export const canAccessDepartment = (user, departmentId) => user.role === 'ADMIN' || (user.role === 'DOCTOR' && user.departments?.some((id) => String(id) === String(departmentId))) || user.role === 'RECEPTIONIST';
