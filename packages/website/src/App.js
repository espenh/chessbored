import React, { Component } from 'react';
import logo from './logo.svg';
import { Thing } from "./thing";
import './App.css';

class App extends Component {
  render() {
    return (
      <div className="App">
        <Thing />
      </div>
    );
  }
}

export default App;
