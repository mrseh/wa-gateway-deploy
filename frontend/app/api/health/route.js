// API Health Check Endpoint
export default function handler(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'frontend'
    }
  });
}
