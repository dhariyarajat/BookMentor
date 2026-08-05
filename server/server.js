app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "https://book-mentor-teal.vercel.app",
        "book-mentor-rajat-dhariya.vercel.app",
      ];

      // Allow Postman/server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Explicitly handle preflight requests
app.options(/.*/, cors());