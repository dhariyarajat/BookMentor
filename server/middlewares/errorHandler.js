import AppError from '../utils/appError.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose duplicate key (e.g. slot just booked by someone else)
  if (err.code === 11000) {
    error = new AppError(
      'This slot was just taken by someone else. Please pick another time.',
      409
    );
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    error = new AppError(message, 400);
  }

  // Cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = new AppError('Invalid resource id.', 400);
  }

  // Google token errors
  if (err.message?.includes('ID_TOKEN') || err.message?.includes('Invalid token')) {
    error = new AppError('Google authentication failed. Please try again.', 401);
  }

  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
