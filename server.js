const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve the HTML file from current directory

// Path to store submissions
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

// Initialize submissions file if it doesn't exist
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
}

// API endpoint to submit crossword results
app.post('/api/submit-crossword', (req, res) => {
  try {
    const submission = req.body;
    
    // Validate submission
    if (!submission.instagram_username || submission.score === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid submission data' 
      });
    }

    // Read existing submissions
    const submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    
    // Add new submission
    submissions.push({
      id: Date.now(),
      ...submission,
      submitted_at: new Date().toISOString()
    });

    // Write back to file
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));

    res.json({ 
      success: true, 
      message: 'Submission saved successfully',
      rank: calculateRank(submission.score, submissions)
    });

  } catch (error) {
    console.error('Error saving submission:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API endpoint to get leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    
    // Sort by score (descending) and then by timestamp (ascending - earlier is better)
    const leaderboard = submissions
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(a.timestamp) - new Date(b.timestamp);
      })
      .slice(0, 100) // Top 100
      .map((entry, index) => ({
        rank: index + 1,
        username: entry.instagram_username,
        score: entry.score,
        total: entry.total_questions,
        percentage: entry.percentage,
        submitted_at: entry.submitted_at
      }));

    res.json({ 
      success: true, 
      leaderboard 
    });

  } catch (error) {
    console.error('Error reading leaderboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API endpoint to get top performers (for admin)
app.get('/api/top-performers', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    
    // Get unique users with their best scores
    const userBestScores = {};
    
    submissions.forEach(entry => {
      const username = entry.instagram_username;
      if (!userBestScores[username] || entry.score > userBestScores[username].score) {
        userBestScores[username] = entry;
      }
    });

    // Sort and get top performers
    const topPerformers = Object.values(userBestScores)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(a.timestamp) - new Date(b.timestamp);
      })
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        username: entry.instagram_username,
        score: entry.score,
        total: entry.total_questions,
        percentage: entry.percentage,
        timestamp: entry.timestamp
      }));

    res.json({ 
      success: true, 
      topPerformers,
      total_count: Object.keys(userBestScores).length
    });

  } catch (error) {
    console.error('Error reading top performers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Helper function to calculate rank
function calculateRank(score, submissions) {
  const betterScores = submissions.filter(s => s.score > score).length;
  return betterScores + 1;
}

// Start server
app.listen(PORT, () => {
  console.log(`🏮 Skylight Crossword Server running on http://localhost:${PORT}`);
  console.log(`📊 Submissions stored in: ${SUBMISSIONS_FILE}`);
  console.log(`🏆 View leaderboard at: http://localhost:${PORT}/api/leaderboard`);
  console.log(`👥 View top performers at: http://localhost:${PORT}/api/top-performers`);
});