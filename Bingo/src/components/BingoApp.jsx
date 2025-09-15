import React, { useState, useEffect, useCallback } from 'react';
import { UserCircle, Grid, ArrowRight, Trophy, Hash, RotateCw, Edit, Plus, Heart, ArrowLeftRight, Clock } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('https://bingo-game-4qbi-bxrsbph4q-ronak-siddhpuras-projects-4ee3a766.vercel.app');

// Helper to generate random bingo card
const generateRandomCard = () => {
  const numbers = [];
  while (numbers.length < 25) {
    const num = Math.floor(Math.random() * 25) + 1;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers;
};

// Helper to check if a line is complete
const checkLine = (card, selectedNumbers, line) => {
  return line.every(index => selectedNumbers.includes(card[index]));
};

// All possible winning lines (rows, columns, diagonals)
const winningLines = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

const BingoApp = () => {
  // Game state
  const [view, setView] = useState('home'); // home, singleplayer, multiplayer, game
  const [playerName, setPlayerName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [isSinglePlayer, setIsSinglePlayer] = useState(true);
  const [playerCard, setPlayerCard] = useState(generateRandomCard());
  const [aiCard, setAiCard] = useState(generateRandomCard());
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [turnMessage, setTurnMessage] = useState('');
  const [completedLines, setCompletedLines] = useState(0);
  const [aiCompletedLines, setAiCompletedLines] = useState(0);
  const [canCallBingo, setCanCallBingo] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [fillMode, setFillMode] = useState('random'); // random or manual
  const [currentTurnPlayer, setCurrentTurnPlayer] = useState(null);

  useEffect(() => {
    socket.on('roomCreated', (data) => {
      setRoomCode(data.roomCode);
      setView('waitingRoom');
    });

    socket.on('joinedRoom', (data) => {
      if (data.success) {
        setView('waitingRoom');
      } else {
        alert(data.message || 'Failed to join room');
      }
    });

    socket.on('playersList', (data) => {
      setPlayers(data.players);
      if (data.maxPlayers) {
        setMaxPlayers(data.maxPlayers);
      }
    });

    socket.on('playerJoined', (data) => {
      // Optionally used if you want to animate a player joining
      console.log('Player joined:', data.player.name);
    });

    socket.on('turnUpdate', (data) => {
      setCurrentTurnPlayer(data.playerName);
      setIsPlayerTurn(data.playerId === socket.id);
      setTurnMessage(`${data.playerName}'s turn`);
    });

    socket.on('numberSelected', (data) => {
      handleNumberSelected(data.number, data.player);
      setTurnMessage(`${data.player} selected number ${data.number}`);
    });

    socket.on('bingoCall', (data) => {
      setGameOver(true);
      setWinner(data.player);
    });

    socket.on('gameStarted', () => {
      setSelectedNumbers([]);
      setTurnMessage('');
      setCompletedLines(0);
      setAiCompletedLines(0);
      setCanCallBingo(false);
      setGameOver(false);
      setWinner(null);
      setIsPlayerTurn(true);
      setView('game');
    });

    socket.on('error', (data) => {
      alert(data.message);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('joinedRoom');
      socket.off('playersList');
      socket.off('playerJoined');
      socket.off('turnUpdate');
      socket.off('numberSelected');
      socket.off('bingoCall');
      socket.off('gameStarted');
      socket.off('error');
    };
  }, []);

  // Check for completed lines
  useEffect(() => {
    if (selectedNumbers.length < 5) return;
    
    let playerLines = 0;
    let aiLines = 0;
    
    winningLines.forEach(line => {
      if (checkLine(playerCard, selectedNumbers, line)) {
        playerLines++;
      }
      if (isSinglePlayer && checkLine(aiCard, selectedNumbers, line)) {
        aiLines++;
      }
    });
    
    setCompletedLines(playerLines);
    if (isSinglePlayer) setAiCompletedLines(aiLines);
    
    // Check if player can call bingo
    if (playerLines >= 5) {
      setCanCallBingo(true);
    }
    
    // In single player, if AI has 5 lines, they might call bingo
    if (isSinglePlayer && aiLines >= 5 && !canCallBingo && Math.random() > 0.3) {
      setTimeout(() => {
        if (!gameOver) {
          setGameOver(true);
          setWinner('Computer');
        }
      }, 2000);
    }
  }, [selectedNumbers, playerCard, aiCard, isSinglePlayer, canCallBingo, gameOver]);

  // AI's turn in single player mode
  useEffect(() => {
    if (isSinglePlayer && !isPlayerTurn && !gameOver) {
      const aiTurn = setTimeout(() => {
        const availableNumbers = Array.from({ length: 25 }, (_, i) => i + 1)
          .filter(num => !selectedNumbers.includes(num));
        
        if (availableNumbers.length > 0) {
          const aiPick = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
          handleNumberSelected(aiPick, 'Computer');
          setTurnMessage(`Computer selected number ${aiPick}`);
          setIsPlayerTurn(true);
        }
      }, 1000);
      
      return () => clearTimeout(aiTurn);
    }
  }, [isPlayerTurn, selectedNumbers, gameOver, isSinglePlayer]);

  // Handle number selection
  const handleNumberSelected = useCallback((number, player) => {
    setSelectedNumbers(prev => [...prev, number]);
  }, []);

  // Player selects a number
  const selectNumber = (number) => {
    if (
      !isPlayerTurn || 
      selectedNumbers.includes(number) || 
      gameOver
    ) return;
    
    if (isSinglePlayer) {
      handleNumberSelected(number, 'You');
      setTurnMessage(`You selected number ${number}`);
      setIsPlayerTurn(false);
    } else {
      // In multiplayer, emit this selection to server
      socket.emit('selectNumber', { number, roomCode });
    }
  };

  // Call Bingo
  const callBingo = () => {
    if (!canCallBingo || gameOver) return;
    
    setGameOver(true);
    setWinner('You');
    
    if (!isSinglePlayer) {
      // In multiplayer, broadcast bingo call
      socket.emit('callBingo', { roomCode });
    }
    
    // Show celebration animation
    const confetti = document.getElementById('confetti');
    confetti.style.display = 'block';
    setTimeout(() => {
      confetti.style.display = 'none';
    }, 5000);
  };

  // Create a room for multiplayer
  const createRoom = () => {
    if (!playerName) {
      alert('Please enter your name');
      return;
    }
    socket.emit('createRoom', { playerName, maxPlayers });
  };

  // Join an existing room
  const joinRoom = () => {
    if (!playerName || !roomCode) {
      alert('Please enter your name and room code');
      return;
    }
    socket.emit('joinRoom', { playerName, roomCode });
  };

  // Start the game (host only in multiplayer)
  const startGame = () => {
    setSelectedNumbers([]);
    setTurnMessage('');
    setCompletedLines(0);
    setAiCompletedLines(0);
    setCanCallBingo(false);
    setGameOver(false);
    setWinner(null);
    setIsPlayerTurn(true);
    setView('game');
    
    if (!isSinglePlayer) {
      socket.emit('startGame', { roomCode });
    }
  };

  // Reset the game
  const resetGame = () => {
    setPlayerCard(generateRandomCard());
    setAiCard(generateRandomCard());
    setSelectedNumbers([]);
    setTurnMessage('');
    setCompletedLines(0);
    setAiCompletedLines(0);
    setCanCallBingo(false);
    setGameOver(false);
    setWinner(null);
    setIsPlayerTurn(true);
  };

  // Generate BINGO header with completed lines highlighted
  const renderBingoHeader = (completedLinesCount) => {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    return (
      <div className="flex justify-center mb-2">
        {letters.map((letter, index) => (
          <div 
            key={index} 
            className={`w-10 h-10 font-bold text-xl flex items-center justify-center mx-1 rounded-md ${
              index < completedLinesCount ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}
          >
            {letter}
          </div>
        ))}
      </div>
    );
  };

  // Render the Bingo card grid
  const renderBingoGrid = (card, isOpponent = false) => {
    return (
      <div className="grid grid-cols-5 gap-2 mb-4">
        {card.map((number, index) => (
          <div
            key={index}
            onClick={() => !isOpponent && selectNumber(number)}
            className={`
              w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center 
              rounded-md font-bold text-lg transition-all duration-200
              ${selectedNumbers.includes(number) 
                ? 'bg-purple-500 text-white transform scale-95' 
                : isOpponent 
                ? 'bg-gray-100 cursor-default'
                : 'bg-white border-2 border-purple-200 hover:border-purple-500 cursor-pointer'
              }
              ${(!isPlayerTurn && !isOpponent) || gameOver ? 'pointer-events-none' : ''}
            `}
          >
            {number}
          </div>
        ))}
      </div>
    );
  };

  // Custom button component
  const Button = ({ children, onClick, className = '', disabled = false }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-md font-semibold transition-all
        ${disabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : 'bg-purple-600 text-white hover:bg-purple-700 active:transform active:scale-95'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );

  // Render different views based on game state
  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold text-purple-600 mb-8">
              <span className="inline-block transform hover:rotate-12 transition-transform duration-300">B</span>
              <span className="inline-block transform hover:rotate-12 transition-transform duration-300">I</span>
              <span className="inline-block transform hover:rotate-12 transition-transform duration-300">N</span>
              <span className="inline-block transform hover:rotate-12 transition-transform duration-300">G</span>
              <span className="inline-block transform hover:rotate-12 transition-transform duration-300">O</span>
            </h1>
            
            <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md mb-6">
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Your Name</label>
                <div className="flex items-center">
                  <UserCircle className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter your name"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 mt-6">
                <Button 
                  onClick={() => {
                    if (!playerName) {
                      alert('Please enter your name');
                      return;
                    }
                    setIsSinglePlayer(true);
                    setPlayerCard(generateRandomCard());
                    setAiCard(generateRandomCard());
                    startGame();
                  }}
                  className="flex items-center justify-center"
                >
                  <UserCircle className="mr-2" />
                  Single Player Mode
                </Button>
                
                <Button
                  onClick={() => {
                    if (!playerName) {
                      alert('Please enter your name');
                      return;
                    }
                    setIsSinglePlayer(false);
                    setView('multiplayer');
                  }}
                  className="flex items-center justify-center"
                >
                  <Grid className="mr-2" />
                  Multiplayer Mode
                </Button>
              </div>
            </div>
          </div>
        );
        
      case 'multiplayer':
        return (
          <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-center text-purple-600 mb-6">Multiplayer Mode</h2>
            
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <h3 className="text-lg font-semibold">Create a Room</h3>
              </div>
              <label className="block text-gray-700 font-medium mb-2">Max Players (2-5)</label>
              <input
                type="number"
                min={2}
                max={5}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Math.min(Math.max(2, Number(e.target.value)), 5))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3"
              />
              <Button onClick={createRoom} className="w-full flex items-center justify-center">
                <Plus className="mr-2" size={18} />
                Create New Room
              </Button>
            </div>
            
            <div className="bg-gray-100 h-px w-full my-6"></div>
            
            <div>
              <div className="flex justify-between mb-2">
                <h3 className="text-lg font-semibold">Join a Room</h3>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Room Code</label>
                <div className="flex items-center">
                  <Hash className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter room code"
                    maxLength={6}
                  />
                </div>
              </div>
              <Button onClick={joinRoom} className="w-full flex items-center justify-center">
                <ArrowRight className="mr-2" size={18} />
                Join Room
              </Button>
            </div>
            
            <button 
              onClick={() => setView('home')}
              className="mt-6 w-full py-2 text-purple-600 hover:text-purple-800"
            >
              Back to home
            </button>
          </div>
        );
        
      case 'waitingRoom':
        return (
          <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-center text-purple-600 mb-6">Waiting Room</h2>
            
            <div className="bg-purple-50 p-4 rounded-md mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Room Code:</span>
                <span className="font-mono font-bold text-xl">{roomCode}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Share this code with others to join your game
              </p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">
                Players ({players.length}/{maxPlayers})
              </h3>
              <div className="space-y-2">
                {players.map((player, index) => (
                  <div key={index} className="flex items-center p-2 bg-gray-50 rounded-md">
                    <UserCircle className="text-purple-500 mr-2" />
                    <span>{player.name} {player.isHost && '(Host)'}</span>
                    {player.id === socket.id && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">You</span>}
                  </div>
                ))}
                
                {Array.from({ length: maxPlayers - players.length }, (_, i) => (
                  <div key={i} className="flex items-center p-2 bg-gray-50 rounded-md text-gray-400">
                    <UserCircle className="mr-2" />
                    <span>Waiting for player...</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex space-x-4">
              <Button 
                onClick={startGame}
                className="flex-1"
                disabled={
                  players.length < 2 || 
                  !players.find(p => p.id === socket.id)?.isHost
                }
              >
                Start Game
                {players.length === maxPlayers && <span className="ml-2 text-xs">(Auto-starting...)</span>}
              </Button>
              
              <Button 
                onClick={() => setView('home')}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Leave Room
              </Button>
            </div>
          </div>
        );
        
      case 'game':
        return (
          <div className="w-full max-w-3xl">
            {/* Confetti celebration (hidden by default) */}
            <div 
              id="confetti" 
              className="fixed inset-0 pointer-events-none z-50 hidden"
              style={{
                background: 'radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)'
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl shadow-2xl transform scale-110">
                  <div className="text-4xl font-bold text-center mb-4">
                    🎉 BINGO! 🎉
                  </div>
                  <div className="text-2xl text-center text-purple-600 font-bold">
                    {winner} Won!
                  </div>
                </div>
              </div>
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: `${Math.random() * 10 + 5}px`,
                    height: `${Math.random() * 10 + 20}px`,
                    background: `hsl(${Math.random() * 360}, 100%, 50%)`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                    animation: `fall ${Math.random() * 3 + 2}s linear forwards, sway ${Math.random() * 4 + 3}s ease-in-out infinite alternate`
                  }}
                />
              ))}
            </div>
            
            {/* Game status */}
            <div className="bg-white p-4 rounded-xl shadow-md mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg text-purple-600">
                    {isSinglePlayer ? 'Single Player Mode' : `Room: ${roomCode}`}
                  </h2>
                  <p className="text-gray-500">
                    {gameOver 
                      ? `Game Over - ${winner} Won!` 
                      : isSinglePlayer
                        ? (isPlayerTurn ? "Your turn" : "Computer's turn")
                        : turnMessage
                    }
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  {canCallBingo && (
                    <Button 
                      onClick={callBingo}
                      className="bg-green-500 hover:bg-green-600 animate-pulse"
                    >
                      BINGO!
                    </Button>
                  )}
                  
                  {gameOver && (
                    <Button 
                      onClick={resetGame}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      Play Again
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => setView('home')}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3"
                  >
                    Exit
                  </Button>
                </div>
              </div>
              
              {!isSinglePlayer && !gameOver && (
                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-sm mb-2">Player Turn Order:</h3>
                  <div className="flex flex-wrap gap-2">
                    {players.map((player, index) => (
                      <div 
                        key={index} 
                        className={`
                         px-3 py-1 rounded-full text-sm font-medium
                          ${currentTurnPlayer === player.name 
                            ? 'bg-purple-600 text-white animate-pulse' 
                            : 'bg-gray-200 text-gray-600'}
                        `}
                      >
                        {player.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bingo cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-purple-50 p-4 rounded-xl">
                <h3 className="font-semibold mb-2">Your Card</h3>
                {renderBingoHeader(completedLines)}
                {renderBingoGrid(playerCard)}
              </div>

              {isSinglePlayer ? (
                <div className="bg-purple-50 p-4 rounded-xl">
                  <h3 className="font-semibold mb-2">Computer's Card</h3>
                  {renderBingoHeader(aiCompletedLines)}
                  {renderBingoGrid(aiCard, true)}
                </div>
              ) : null}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      {renderView()}
    </div>
  );
};


export default BingoApp;
