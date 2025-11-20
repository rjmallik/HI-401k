# Human Interest 401(k) Contribution Page

This project is a full-stack demo of a 401(k) contribution page. It consists of a React + Vite single-page application and a Node.js Express backend. The application loads mock user data, allows the user to adjust contribution settings, shows live retirement projections, and saves updates to a backend API. The entire project runs locally with Node and npm.

## Project Structure

hi-401k/
  backend/          Express API
  frontend/         React SPA (Vite)

## Requirements

Node.js (version 18 or higher)
npm

## Running the Backend

Open a terminal and run the following:

cd backend
npm install
npm run dev

The backend will start on:

http://localhost:4000

Keep this terminal window open.

## Running the Frontend

Open a second terminal and run:

cd frontend
npm install
npm run dev

The frontend will start on:

http://localhost:5173

Open this URL in your browser.

## Saving Data

All snapshot and contribution information is stored in an in-memory object on the backend. When the user clicks “Save contribution rate,” the frontend sends the updated values to the backend using POST /api/contribution. Because the backend uses in-memory storage, data resets when the backend server restarts.

## Summary

To run the application:
1. Start the backend using npm run dev inside the backend folder.
2. Start the frontend using npm run dev inside the frontend folder.
3. Open http://localhost:5173 in a browser.

The application will be fully functional and ready to use.
