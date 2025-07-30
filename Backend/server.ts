
import express, { Express, Request , Response } from "express";
import cors from "cors";
import MailRouter from "./Routes/MailRoutes";
import { handleCallback } from "./Services/authService";
import {connectDB} from "./Config/dbConfig";
import { SchedulingService } from "./Services/schedulingService";
import dotenv from "dotenv";
dotenv.config();

const app:Express = express();
const PORT = process.env.PORT;

//middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(
    cors({
      origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "https://smartmailsender.netlify.app"],
      credentials: true, 
    })
);

// Enhanced request/response logging middleware
app.use((req: Request, res: Response, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  // Log incoming request
  console.log(`\n🔵 [${requestId}] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`📋 [${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
  
  // Log query parameters if present
  if (Object.keys(req.query).length > 0) {
    console.log(`❓ [${requestId}] Query:`, JSON.stringify(req.query, null, 2));
  }
  
  // Log body for POST/PUT requests (but limit size for file uploads)
  if (req.method !== 'GET' && req.body) {
    const bodyToLog = JSON.stringify(req.body).length > 1000 
      ? JSON.stringify(req.body).substring(0, 1000) + '... [TRUNCATED]'
      : JSON.stringify(req.body, null, 2);
    console.log(`📦 [${requestId}] Body:`, bodyToLog);
  }
  
  // Log file uploads
  if (req.files) {
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    console.log(`📁 [${requestId}] Files:`, files.map((f: any) => ({ 
      fieldname: f.fieldname, 
      originalname: f.originalname, 
      size: f.size,
      mimetype: f.mimetype 
    })));
  }
  
  // Store request ID for response logging
  (req as any).requestId = requestId;
  
  // Intercept response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    console.log(`\n🟢 [${requestId}] Response Status: ${res.statusCode} | Duration: ${duration}ms`);
    
    // Log response data (limit size)
    const responseToLog = typeof data === 'string' && data.length > 1000 
      ? data.substring(0, 1000) + '... [TRUNCATED]'
      : data;
    console.log(`📤 [${requestId}] Response:`, responseToLog);
    console.log(`═══════════════════════════════════════════════════════════════\n`);
    
    return originalSend.call(this, data);
  };
  
  next();
});

app.use("/api" , MailRouter);
app.get("/callback", handleCallback);

// Expose Google client ID to frontend
app.get("/api/google-config", (req: Request, res: Response) => {
  res.json({
    clientId: process.env.CLIENT_ID
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Initialize database and start scheduler
connectDB().then(() => {
    // Start the email scheduler
    const schedulingService = new SchedulingService();
    schedulingService.startScheduler();
    
    app.listen(PORT , ()=>{
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});
