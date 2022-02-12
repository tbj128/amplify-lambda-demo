import React from 'react';
import { useEffect } from 'react';
import './App.css';
import Home from './components/Home';

function App() {
    useEffect(() => {
      document.title = "ED Monitor";
    });

    return (
        <div className="App">
            <Home></Home>
        </div>
    );
}

export default App;
