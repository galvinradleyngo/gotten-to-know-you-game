const { useState, useEffect } = React;
const { Users, Play, UserPlus, Trophy, CheckCircle, XCircle, Clock, Star } = lucide;

const GetToKnowYouGame = () => {
  // State variables
  const [gameState, setGameState] = useState('menu');
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerFact, setPlayerFact] = useState('');
  const [currentGame, setCurrentGame] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [gameQuestions, setGameQuestions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [timerActive, setTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);

  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDU32POTx2DzJoijpyMiv-yZHRJQAH1foA",
    authDomain: "gotten-to-know-you.firebaseapp.com",
    databaseURL: "https://gotten-to-know-you-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gotten-to-know-you",
    storageBucket: "gotten-to-know-you.firebasestorage.app",
    messagingSenderId: "553283770730",
    appId: "1:553283770730:web:41c81f52de885116b0ed13"
  };

  // Client-side QR code generation
  const generateQRCodeSVG = (text) => {
    const size = 200;
    const modules = 25;
    const moduleSize = size / modules;
    
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;
    
    const finderPattern = (x, y) => {
      return `<rect x="${x}" y="${y}" width="${moduleSize * 7}" height="${moduleSize * 7}" fill="black"/>
              <rect x="${x + moduleSize}" y="${y + moduleSize}" width="${moduleSize * 5}" height="${moduleSize * 5}" fill="white"/>
              <rect x="${x + moduleSize * 2}" y="${y + moduleSize * 2}" width="${moduleSize * 3}" height="${moduleSize * 3}" fill="black"/>`;
    };
    
    svg += finderPattern(0, 0);
    svg += finderPattern(size - moduleSize * 7, 0);
    svg += finderPattern(0, size - moduleSize * 7);
    
    for (let i = 0; i < modules; i++) {
      for (let j = 0; j < modules; j++) {
        if ((i < 8 && j < 8) || (i < 8 && j >= modules - 8) || (i >= modules - 8 && j < 8)) {
          continue;
        }
        
        const shouldFill = ((i * j + hash) % 3) === 0;
        if (shouldFill) {
          svg += `<rect x="${i * moduleSize}" y="${j * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }
    
    svg += '</svg>';
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // URL-based game sharing
  const createGameDataUrl = (gameData) => {
    const compressed = btoa(JSON.stringify(gameData));
    return `${window.location.origin}${window.location.pathname}?game=${compressed}`;
  };

  const getGameFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    if (gameParam) {
      try {
        return JSON.parse(atob(gameParam));
      } catch (e) {
        console.error('Invalid game URL');
      }
    }
    return null;
  };

  // Firebase API functions
  const createGameInFirebase = async (gameData) => {
    const response = await fetch(`${firebaseConfig.databaseURL}/games/${gameData.code}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData)
    });
    
    if (!response.ok) {
      throw new Error(`Firebase error: ${response.status}`);
    }
    
    return gameData;
  };

  const getGameFromFirebase = async (gameCode) => {
    const response = await fetch(`${firebaseConfig.databaseURL}/games/${gameCode}.json`);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Firebase error: ${response.status}`);
    }
    
    return await response.json();
  };

  const updateGameInFirebase = async (gameCode, updates) => {
    const response = await fetch(`${firebaseConfig.databaseURL}/games/${gameCode}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      throw new Error(`Firebase error: ${response.status}`);
    }
    
    return await response.json();
  };

  // Utility functions
  const generateGameCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const generateQuestions = (players) => {
    return players.map((player) => {
      const otherPlayers = players.filter(p => p.id !== player.id);
      const randomOptions = otherPlayers.sort(() => 0.5 - Math.random()).slice(0, Math.min(3, otherPlayers.length));
      const allOptions = [player, ...randomOptions].sort(() => 0.5 - Math.random());
      
      return {
        fact: player.fact,
        correctAnswer: player.name,
        options: allOptions.map(p => p.name),
        correctIndex: allOptions.findIndex(p => p.id === player.id)
      };
    });
  };
  // Check for game in URL on component mount
  useEffect(() => {
    const urlGame = getGameFromUrl();
    if (urlGame && !currentGame) {
      setCurrentGame(urlGame);
      setGameCode(urlGame.code);
      setGameState('student-join');
    }
  }, []);

  // Polling for real-time updates
  useEffect(() => {
    let interval;
    
    if (gameCode && (gameState === 'teacher-dashboard' || gameState === 'student-join')) {
      interval = setInterval(async () => {
        try {
          const gameData = await getGameFromFirebase(gameCode);
          if (gameData) {
            setCurrentGame(prevGame => {
              if (!prevGame || 
                  prevGame.players.length !== gameData.players.length || 
                  prevGame.isStarted !== gameData.isStarted) {
                return gameData;
              }
              return prevGame;
            });
            
            if (gameState === 'student-join' && gameData.isStarted && currentGame && !currentGame.isStarted) {
              const questions = generateQuestions(gameData.players);
              setGameQuestions(questions);
              setGameState('game-play');
              setCurrentQuestion(0);
              setScore(0);
              setSelectedAnswer(null);
              setShowResult(false);
              setTimeLeft(15);
              setTimerActive(true);
            }
          }
        } catch (error) {
          console.error('Error polling game data:', error);
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameCode, gameState, currentGame]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      handleAnswer(-1);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // Game action functions
  const createGame = async () => {
    setLoading(true);
    setError('');
    
    const code = generateGameCode();
    const newGame = {
      code,
      players: [],
      isStarted: false,
      createdAt: new Date().toISOString(),
      createdBy: 'teacher'
    };
    
    try {
      await Promise.race([
        createGameInFirebase(newGame),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      console.log('✅ Firebase working');
    } catch (error) {
      console.log('📱 Using local mode');
    }
    
    const games = JSON.parse(localStorage.getItem('gtkn-games') || '{}');
    games[code] = newGame;
    localStorage.setItem('gtkn-games', JSON.stringify(games));
    
    setGameCode(code);
    setCurrentGame(newGame);
    setGameState('teacher-dashboard');
    setLoading(false);
  };

  const joinGame = async () => {
    if (!gameCode.trim()) {
      setError('Please enter a game code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const game = await getGameFromFirebase(gameCode.toUpperCase());
      if (game) {
        if (game.isStarted) {
          setError('Game has already started!');
          return;
        }
        setCurrentGame(game);
        setGameCode(gameCode.toUpperCase());
        setGameState('student-submit');
        return;
      }
    } catch (firebaseError) {
      console.log('Firebase failed, trying localStorage:', firebaseError);
    }
    
    try {
      const games = JSON.parse(localStorage.getItem('gtkn-games') || '{}');
      const localGame = games[gameCode.toUpperCase()];
      
      if (localGame) {
        if (localGame.isStarted) {
          setError('Game has already started!');
          return;
        }
        setCurrentGame(localGame);
        setGameCode(gameCode.toUpperCase());
        setGameState('student-submit');
        return;
      }
    } catch (localError) {
      console.log('localStorage also failed:', localError);
    }
    
    setError('Game not found! Please check the code or make sure you\'re on the same network as the teacher.');
    setLoading(false);
  };

  const submitFact = async () => {
    if (!playerName.trim() || !playerFact.trim()) {
      setError('Please fill in both your name and fact!');
      return;
    }

    if (currentGame.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      setError('Someone with this name has already joined! Please use a different name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newPlayer = { 
        name: playerName.trim(), 
        fact: playerFact.trim(), 
        id: Date.now() + Math.random() 
      };
      
      const updatedPlayers = [...currentGame.players, newPlayer];
      
      try {
        await updateGameInFirebase(gameCode, { players: updatedPlayers });
      } catch (firebaseError) {
        console.log('Firebase update failed, using localStorage');
        const games = JSON.parse(localStorage.getItem('gtkn-games') || '{}');
        games[gameCode] = { ...currentGame, players: updatedPlayers };
        localStorage.setItem('gtkn-games', JSON.stringify(games));
      }
      
      setCurrentGame(prev => ({ ...prev, players: updatedPlayers }));
      setGameState('student-join');
    } catch (error) {
      setError('Failed to submit. Please try again.');
      console.error('Submit fact error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (currentGame.players.length < 2) {
      setError('Need at least 2 players to start the game!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      try {
        await updateGameInFirebase(gameCode, {
          isStarted: true,
          startedAt: new Date().toISOString()
        });
      } catch (firebaseError) {
        console.log('Firebase update failed, using localStorage');
        const games = JSON.parse(localStorage.getItem('gtkn-games') || '{}');
        games[gameCode] = { ...currentGame, isStarted: true, startedAt: new Date().toISOString() };
        localStorage.setItem('gtkn-games', JSON.stringify(games));
      }
      
      setCurrentGame(prev => ({ ...prev, isStarted: true }));
    } catch (error) {
      setError('Failed to start game. Please try again.');
      console.error('Start game error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startGameAsTeacher = async () => {
    if (currentGame.players.length < 1) {
      setError('Need at least 1 player to start the game!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      try {
        await updateGameInFirebase(gameCode, {
          isStarted: true,
          startedAt: new Date().toISOString()
        });
      } catch (firebaseError) {
        console.log('Firebase update failed, using localStorage');
        const games = JSON.parse(localStorage.getItem('gtkn-games') || '{}');
        games[gameCode] = { ...currentGame, isStarted: true, startedAt: new Date().toISOString() };
        localStorage.setItem('gtkn-games', JSON.stringify(games));
      }

      const questions = generateQuestions(currentGame.players);
      setGameQuestions(questions);
      setGameState('game-play');
      setCurrentQuestion(0);
      setScore(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeLeft(15);
      setTimerActive(true);
    } catch (error) {
      setError('Failed to start game. Please try again.');
      console.error('Start game as teacher error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answerIndex) => {
    if (showResult) return;
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);
    setTimerActive(false);
    
    if (answerIndex === gameQuestions[currentQuestion].correctIndex) {
      setScore(prev => prev + 1);
    }

    setTimeout(() => {
      if (currentQuestion < gameQuestions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setShowResult(false);
        setTimeLeft(15);
        setTimerActive(true);
      } else {
        setGameState('results');
      }
    }, 2000);
  };

  const resetGame = () => {
    setGameState('menu');
    setGameCode('');
    setPlayerName('');
    setPlayerFact('');
    setCurrentGame(null);
    setCurrentQuestion(0);
    setScore(0);
    setGameQuestions([]);
    setSelectedAnswer(null);
    setShowResult(false);
    setTimeLeft(15);
    setTimerActive(false);
    setLoading(false);
    setError('');
  };
  // UI Components
  const ErrorDisplay = ({ message }) => (
    message ? React.createElement('div', {
      className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-2xl mb-4'
    }, message) : null
  );

  const LoadingSpinner = () => React.createElement('div', {
    className: 'flex items-center justify-center'
  }, React.createElement('div', {
    className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-white'
  }));

  // Main menu
  if (gameState === 'menu') {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 flex items-center justify-center p-4'
    }, 
      React.createElement('div', {
        className: 'bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center'
      },
        React.createElement('div', { className: 'mb-8' },
          React.createElement('div', {
            className: 'bg-gradient-to-r from-purple-500 to-pink-500 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4'
          }, React.createElement(Users, { className: 'w-10 h-10 text-white' })),
          React.createElement('h1', {
            className: 'text-3xl font-bold text-gray-800 mb-2'
          }, 'Gotten to Know You!'),
          React.createElement('p', {
            className: 'text-gray-600'
          }, 'A fun classroom game to learn about each other')
        ),
        React.createElement('div', { className: 'space-y-4' },
          React.createElement('button', {
            onClick: () => setGameState('teacher-setup'),
            className: 'w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg'
          },
            React.createElement(Play, { className: 'w-5 h-5 inline mr-2' }),
            "I'm a Teacher"
          ),
          React.createElement('button', {
            onClick: () => setGameState('student-join'),
            className: 'w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg'
          },
            React.createElement(UserPlus, { className: 'w-5 h-5 inline mr-2' }),
            "I'm a Student"
          )
        )
      )
    );
  }

  // Teacher setup
  if (gameState === 'teacher-setup') {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4'
    },
      React.createElement('div', {
        className: 'bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center'
      },
        React.createElement('h2', {
          className: 'text-2xl font-bold text-gray-800 mb-6'
        }, 'Create New Game'),
        React.createElement('p', {
          className: 'text-gray-600 mb-8'
        }, 'Click the button below to create a new game and get your game code!'),
        React.createElement(ErrorDisplay, { message: error }),
        React.createElement('button', {
          onClick: createGame,
          disabled: loading,
          className: 'w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg mb-4'
        }, loading ? React.createElement(LoadingSpinner) : 'Create Game'),
        React.createElement('button', {
          onClick: () => setGameState('menu'),
          className: 'w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-2xl transition-all duration-300'
        }, 'Back to Menu')
      )
    );
  }
  // Teacher dashboard
  if (gameState === 'teacher-dashboard') {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-4'
    },
      React.createElement('div', {
        className: 'max-w-4xl mx-auto'
      },
        React.createElement('div', {
          className: 'bg-white rounded-3xl shadow-2xl p-8'
        },
          React.createElement('div', {
            className: 'text-center mb-8'
          },
            React.createElement('h2', {
              className: 'text-3xl font-bold text-gray-800 mb-2'
            }, 'Teacher Dashboard'),
            React.createElement('div', {
              className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-2xl inline-block text-xl font-bold'
            }, `Game Code: ${gameCode}`),
            React.createElement('div', {
              className: 'mt-4'
            },
              React.createElement('div', {
                className: 'bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded-2xl'
              },
                React.createElement('strong', {}, '📱 For students to join from their devices:'),
                React.createElement('div', {
                  className: 'mt-4 space-y-3'
                },
                  // QR Code Section
                  React.createElement('div', {
                    className: 'bg-white p-4 rounded-lg border-2 border-green-200'
                  },
                    React.createElement('div', {
                      className: 'flex items-center justify-between mb-3'
                    },
                      React.createElement('span', {
                        className: 'font-semibold text-lg'
                      }, '📱 QR Code (Fastest!)'),
                      React.createElement('button', {
                        onClick: () => setShowQRCode(!showQRCode),
                        className: 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold'
                      }, showQRCode ? 'Hide' : 'Show', ' QR Code')
                    ),
                    showQRCode && React.createElement('div', {
                      className: 'text-center'
                    },
                      React.createElement('div', {
                        className: 'inline-block p-4 bg-white border-2 border-gray-300 rounded-lg'
                      },
                        React.createElement('img', {
                          src: generateQRCodeSVG(createGameDataUrl(currentGame)),
                          alt: 'QR Code to join game',
                          className: 'w-48 h-48'
                        })
                      ),
                      React.createElement('div', {
                        className: 'mt-3 space-y-2'
                      },
                        React.createElement('p', {
                          className: 'text-sm font-semibold text-gray-700'
                        }, '📸 Students: Point your camera at this code!'),
                        React.createElement('p', {
                          className: 'text-xs text-gray-600'
                        }, 'Most phones will automatically detect the QR code and offer to open the link'),
                        React.createElement('div', {
                          className: 'text-xs text-gray-500 bg-gray-50 p-2 rounded'
                        }, 'Backup: If QR doesn\'t work, use game code: ', React.createElement('strong', {}, gameCode))
                      )
                    )
                  ),
                  // Manual Instructions
                  React.createElement('div', {
                    className: 'bg-white p-4 rounded-lg border'
                  },
                    React.createElement('div', {
                      className: 'text-center'
                    },
                      React.createElement('div', {
                        className: 'text-4xl mb-2'
                      }, '📱'),
                      React.createElement('div', {
                        className: 'text-lg font-bold text-gray-800 mb-2'
                      }, 'Manual Instructions'),
                      React.createElement('div', {
                        className: 'space-y-1 text-sm text-gray-700 mb-3'
                      },
                        React.createElement('div', {}, '1. Go to: ', React.createElement('span', {
                          className: 'font-mono bg-gray-100 px-2 py-1 rounded'
                        }, window.location.host)),
                        React.createElement('div', {}, '2. Click "I\'m a Student"'),
                        React.createElement('div', {}, '3. Enter code: ', React.createElement('span', {
                          className: 'bg-yellow-300 px-2 py-1 rounded font-bold'
                        }, gameCode))
                      ),
                      React.createElement('button', {
                        onClick: () => {
                          const message = `🎮 Join our class game!\n\n1. Go to: ${window.location.host}\n2. Click "I'm a Student"\n3. Enter code: ${gameCode}\n\nLet's play!`;
                          navigator.clipboard.writeText(message);
                          alert('✅ Instructions copied! Share via WhatsApp, email, or text.');
                        },
                        className: 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold'
                      }, '📋 Copy Instructions to Share')
                    )
                  ),
                  // Quick Copy Buttons
                  React.createElement('div', {
                    className: 'grid grid-cols-2 gap-3'
                  },
                    React.createElement('button', {
                      onClick: () => {
                        navigator.clipboard.writeText(gameCode);
                        alert('Game code copied!');
                      },
                      className: 'bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm font-semibold'
                    }, '🔢 Copy Code Only'),
                    React.createElement('button', {
                      onClick: () => {
                        const url = window.location.origin + window.location.pathname;
                        navigator.clipboard.writeText(url);
                        alert('Website link copied!');
                      },
                      className: 'bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-semibold'
                    }, '🔗 Copy Website')
                  )
                )
              )
            ),
            currentGame?.isStarted && React.createElement('div', {
              className: 'mt-4 text-green-600 font-semibold'
            }, '🎮 Game Started! Students are now playing.')
          ),
          // Players list
          React.createElement('div', {
            className: 'mb-8'
          },
            React.createElement('h3', {
              className: 'text-xl font-semibold text-gray-700 mb-4'
            }, `Players (${currentGame?.players?.length || 0})`),
            React.createElement('div', {
              className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            },
              currentGame?.players?.map((player, index) =>
                React.createElement('div', {
                  key: player.id,
                  className: 'bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-2xl border-2 border-green-200'
                },
                  React.createElement('div', {
                    className: 'flex items-

      React.createElement('div', {
                    className: 'flex items-center'
                  },
                    React.createElement(CheckCircle, { className: 'w-6 h-6 text-green-500 mr-3' }),
                    React.createElement('div', {},
                      React.createElement('p', {
                        className: 'font-semibold text-gray-800'
                      }, player.name),
                      React.createElement('p', {
                        className: 'text-sm text-gray-600'
                      }, '✓ Fact submitted')
                    )
                  )
                )
              ) || []
            )
          ),
          React.createElement(ErrorDisplay, { message: error }),
          // Control buttons
          React.createElement('div', {
            className: 'text-center space-y-4'
          },
            !currentGame?.isStarted ? React.createElement('div', {
              className: 'flex flex-col sm:flex-row gap-4 justify-center'
            },
              React.createElement('button', {
                onClick: startGame,
                disabled: loading || !currentGame?.players?.length || currentGame.players.length < 2,
                className: 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:cursor-not-allowed'
              }, loading ? React.createElement(LoadingSpinner) : 'Start Game (Students)'),
              React.createElement('button', {
                onClick: startGameAsTeacher,
                disabled: loading || !currentGame?.players?.length,
                className: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:cursor-not-allowed'
              }, loading ? React.createElement(LoadingSpinner) : 'Play as Teacher')
            ) : React.createElement('div', {
              className: 'bg-green-100 p-6 rounded-2xl'
            },
              React.createElement('h3', {
                className: 'text-xl font-semibold text-green-800 mb-2'
              }, 'Game in Progress!'),
              React.createElement('p', {
                className: 'text-green-700'
              }, 'Students are now playing the game with the facts they submitted.')
            ),
            React.createElement('p', {
              className: 'text-sm text-gray-600 max-w-md mx-auto'
            }, '"Start Game (Students)" requires 2+ players. "Play as Teacher" lets you test the game yourself with any number of players.'),
            React.createElement('button', {
              onClick: resetGame,
              className: 'block mx-auto bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-2xl transition-all duration-300'
            }, 'Back to Menu')
          )
        )
      )
    );
  }

  // Student join
  if (gameState === 'student-join') {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-green-600 via-teal-600 to-blue-600 flex items-center justify-center p-4'
    },
      React.createElement('div', {
        className: 'bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center'
      },
        React.createElement('h2', {
          className: 'text-2xl font-bold text-gray-800 mb-6'
        }, 'Join Game'),
        currentGame ? React.createElement('div', {
          className: 'space-y-6'
        },
          React.createElement('div', {
            className: 'bg-gradient-to-r from-green-100 to-blue-100 p-6 rounded-2xl'
          },
            React.createElement(CheckCircle, { className: 'w-12 h-12 text-green-500 mx-auto mb-4' }),
            React.createElement('h3', {
              className: 'text-xl font-semibold text-gray-800 mb-2'
            }, 'Successfully Joined!'),
            React.createElement('p', {
              className: 'text-gray-600 mb-2'
            }, `Hi ${playerName}! Waiting for the teacher to start the game...`),
            React.createElement('p', {
              className: 'text-sm text-gray-500'
            }, `Players: ${currentGame.players.length}`),
            React.createElement('div', {
              className: 'mt-4 text-xs text-gray-400'
            }, 'Game will start automatically when teacher begins')
          )
        ) : React.createElement('div', {
          className: 'space-y-6'
        },
          React.createElement(ErrorDisplay, { message: error }),
          React.createElement('div', {},
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-2'
            }, 'Game Code'),
            React.createElement('input', {
              type: 'text',
              value: gameCode,
              onChange: (e) => setGameCode(e.target.value.toUpperCase()),
              placeholder: 'Enter game code',
              className: 'w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none text-center text-lg font-semibold',
              maxLength: 6
            })
          ),
          React.createElement('button', {
            onClick: joinGame,
            disabled: loading,
            className: 'w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg'
          }, loading ? React.createElement(LoadingSpinner) : 'Join Game')
        ),
        React.createElement('button', {
          onClick: resetGame,
          className: 'w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-2xl transition-all duration-300 mt-4'
        }, 'Back to Menu')
      )
    );
  }

  // Student submit fact
  if (gameState === 'student-submit') {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-green-600 via-teal-600 to-blue-600 flex items-center justify-center p-4'
    },
      React.createElement('div', {
        className: 'bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full'
      },
        React.createElement('h2', {
          className: 'text-2xl font-bold text-gray-800 mb-6 text-center'
        }, 'Submit Your Info'),
        React.createElement(ErrorDisplay, { message: error }),
        React.createElement('div', {
          className: 'space-y-6'
        },
          React.createElement('div', {},
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-2'
            }, 'Your Name'),
            React.createElement('input', {
              type: 'text',
              value: playerName,
              onChange: (e) => setPlayerName(e.target.value),
              placeholder: 'Enter your name',
              className: 'w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none',
              maxLength: 30
            })
          ),
          React.createElement('div', {},
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-2'
            }, 'Fun Fact About You'),
            React.createElement('textarea', {
              value: playerFact,
              onChange: (e) => setPlayerFact(e.target.value),
              placeholder: 'Share something interesting about yourself that you haven\'t told anyone in class...',
              className: 'w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none resize-none h-24',
              maxLength: 150
            }),
            React.createElement('p', {
              className: 'text-sm text-gray-500 mt-1'
            }, `${playerFact.length}/150`)
          ),
          React.createElement('button', {
            onClick: submitFact,
            disabled: loading,
            className: 'w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg'
          }, loading ? React.createElement(LoadingSpinner) : 'Submit')
        )
      )
    );
  }
  // Game play
  if (gameState === 'game-play') {
    if (!gameQuestions.length || currentQuestion >= gameQuestions.length) {
      return React.createElement('div', {
        className: 'min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center p-4'
      },
        React.createElement('div', {
          className: 'bg-white rounded-3xl shadow-2xl p-8 text-center'
        },
          React.createElement(LoadingSpinner),
          React.createElement('p', {
            className: 'text-xl text-gray-800 mt-4'
          }, 'Loading game...')
        )
      );
    }
    
    const question = gameQuestions[currentQuestion];
    
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 p-4'
    },
      React.createElement('div', {
        className: 'max-w-2xl mx-auto'
      },
        React.createElement('div', {
          className: 'bg-white rounded-3xl shadow-2xl p-8'
        },
          React.createElement('div', {
            className: 'text-center mb-8'
          },
            React.createElement('div', {
              className: 'flex justify-between items-center mb-4'
            },
              React.createElement('div', {
                className: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-2xl'
              }, `Question ${currentQuestion + 1}/${gameQuestions.length}`),
              React.createElement('div', {
                className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-2xl'
              }, `Score: ${score}`)
            ),
            React.createElement('div', {
              className: 'flex justify-center mb-4'
            },
              React.createElement('div', {
                className: `w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                  timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-gradient-to-r from-green-400 to-blue-500 text-white'
                }`
              },
                React.createElement(Clock, { className: 'w-6 h-6 mr-1' }),
                timeLeft
              )
            )
          ),
          React.createElement('div', {
            className: 'mb-8'
          },
            React.createElement('h3', {
              className: 'text-xl font-semibold text-gray-800 mb-4 text-center'
            }, 'Who said this?'),
            React.createElement('div', {
              className: 'bg-gradient-to-r from-blue-100 to-purple-100 p-6 rounded-2xl border-2 border-blue-200'
            },
              React.createElement('p', {
                className: 'text-lg text-gray-800 text-center italic'
              }, `"${question.fact}"`)
            )
          ),
          React.createElement('div', {
            className: 'space-y-3'
          },
            question.options.map((option, index) =>
              React.createElement('button', {
                key: index,
                onClick: () => handleAnswer(index),
                disabled: showResult,
                className: `w-full p-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                  showResult
                    ? index === question.correctIndex
                      ? 'bg-green-500 text-white'
                      : index === selectedAnswer
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-300 text-gray-700'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg'
                }`
              },
                option,
                showResult && index === question.correctIndex && React.createElement(CheckCircle, { className: 'w-5 h-5 inline ml-2' }),
                showResult && index === selectedAnswer && index !== question.correctIndex && React.createElement(XCircle, { className: 'w-5 h-5 inline ml-2' })
              )
            )
          ),
          showResult && React.createElement('div', {
            className: 'text-center mt-6'
          },
            React.createElement('p', {
              className: 'text-lg font-semibold text-gray-800'
            }, selectedAnswer === question.correctIndex ? '🎉 Correct!' : '😅 Not quite!')
          )
        )
      )
    );
  }

  // Results
  if (gameState === 'results') {
    const percentage = Math.round((score / gameQuestions.length) * 100);
    
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-yellow-600 via-orange-600 to-red-600 flex items-center justify-center p-4'
    },
      React.createElement('div', {
        className: 'bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center'
      },
        React.createElement('div', {
          className: 'mb-8'
        },
          React.createElement('div', {
            className: 'bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4'
          }, React.createElement(Trophy, { className: 'w-10 h-10 text-white' })),
          React.createElement('h2', {
            className: 'text-3xl font-bold text-gray-800 mb-2'
          }, 'Game Complete!')
        ),
        React.createElement('div', {
          className: 'space-y-6'
        },
          React.createElement('div', {
            className: 'bg-gradient-to-r from-yellow-100 to-orange-100 p-6 rounded-2xl'
          },
            React.createElement('h3', {
              className: 'text-2xl font-bold text-gray-800 mb-2'
            }, 'Your Score'),
            React.createElement('div', {
              className: 'text-5xl font-bold text-orange-600 mb-2'
            }, score),
            React.createElement('div', {
              className: 'text-lg text-gray-600'
            }, `out of ${gameQuestions.length} questions`),
            React.createElement('div', {
              className: 'text-2xl font-semibold text-gray-800 mt-2'
            }, `${percentage}%`)
          ),
          React.createElement('div', {
            className: 'flex justify-center'
          },
            percentage >= 80 && React.createElement('div', {
              className: 'text-6xl animate-bounce'
            }, '🏆'),
            percentage >= 60 && percentage < 80 && React.createElement('div', {
              className: 'text-6xl animate-bounce'
            }, '🥈'),
            percentage >= 40 && percentage < 60 && React.createElement('div', {
              className: 'text-6xl animate-bounce'
            }, '🥉'),
            percentage < 40 && React.createElement('div', {
              className: 'text-6xl animate-bounce'
            }, '🎯')
          ),
          React.createElement('p', {
            className: 'text-lg text-gray-600'
          }, 
            percentage >= 80 ? 'Amazing! You really know your classmates!' :
            percentage >= 60 ? 'Great job! You know your classmates well.' :
            percentage >= 40 ? 'Not bad! There\'s still more to learn.' :
            'Time to get to know your classmates better!'
          ),
          React.createElement('button', {
            onClick: resetGame,
            className: 'w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg'
          }, 'Play Again')
        )
      )
    );
  }

  return null;
};

// Render the app
ReactDOM.render(React.createElement(GetToKnowYouGame), document.getElementById('root'));
