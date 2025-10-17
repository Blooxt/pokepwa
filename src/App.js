import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [allPokemons, setAllPokemons] = useState([]);
  const [displayedPokemons, setDisplayedPokemons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState([]);
  const searchTimeoutRef = useRef(null);
  const pokemonsPerPage = 20;
  const totalPokemons = 1025; // Pokémon únicos hasta la generación 8

  // Lista de patrones para excluir variantes
  const excludedPatterns = [
    '-mega', '-gmax', '-alola', '-galar', '-hisui', '-paldea',
    '-totem', '-eternamax', '-primal', '-ash', '-battle', 
    '-noice', '-noface', '-original', '-starter', '-cosplay',
    '-rock-star', '-belle', '-pop-star', '-phd', '-libre',
    '-10', '-25', '-50', '-100', '-confined', '-unbound',
    '-disguised', '-school', '-sensu', '-dada', '-hero'
  ];

  // Función para filtrar variantes
  const filterVariants = (pokemonList) => {
    return pokemonList.filter(pokemon => {
      const name = pokemon.name.toLowerCase();
      
      // Excluir Pokémon que contengan patrones de variantes
      const isVariant = excludedPatterns.some(pattern => name.includes(pattern));
      
      // Excluir formas específicas problemáticas
      const excludedForms = [
        'pikachu-', 'unown-', 'castform-', 'deoxys-', 'wormadam-',
        'shaymin-', 'giratina-', 'rotom-', 'basculin-', 'darmanitan-',
        'meloetta-', 'genesect-', 'vivillon-', 'flabebe-', 'floette-',
        'florges-', 'furfrou-', 'hoopa-', 'oricorio-', 'lycanroc-',
        'wishiwashi-', 'silvally-', 'minior-', 'mimikyu-', 'necrozma-',
        'magearna-', 'cramorant-', 'eiscue-', 'morpeko-', 'zacian-',
        'zamazenta-', 'eternatus-', 'urshifu-', 'calyrex-'
      ];
      
      const isExcludedForm = excludedForms.some(form => name.startsWith(form));
      
      // Mantener solo la forma base (sin sufijos)
      const isBaseForm = !isVariant && !isExcludedForm && !name.includes('-') && 
                        !name.includes('eternamax') && !name.includes('totem');
      
      return isBaseForm;
    });
  };

  // Efecto para detectar cambios de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Conexión restaurada');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Sin conexión - Modo offline activado');
      loadOfflineData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    loadOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchPokemons();
  }, [currentPage]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (search.trim() === '') {
      const offset = (currentPage - 1) * pokemonsPerPage;
      const endIndex = offset + pokemonsPerPage;
      const pagePokemons = allPokemons.slice(offset, endIndex).filter(pokemon => pokemon);
      setDisplayedPokemons(pagePokemons);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      performGlobalSearch(search.trim());
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search, allPokemons, currentPage]);

  // Función para cargar datos offline del localStorage
  const loadOfflineData = () => {
    try {
      const saved = localStorage.getItem('pokedex_offline_data');
      if (saved) {
        const data = JSON.parse(saved);
        setOfflineData(data);
        console.log('Datos offline cargados:', data.length, 'pokémon');
      }
    } catch (error) {
      console.error('Error cargando datos offline:', error);
    }
  };

  // Función para guardar datos en localStorage
  const saveToOfflineStorage = (pokemons) => {
    try {
      const toSave = pokemons.map(pokemon => ({
        id: pokemon.id,
        name: pokemon.name,
        sprites: {
          front_default: pokemon.sprites.front_default,
          other: {
            'official-artwork': {
              front_default: pokemon.sprites.other?.['official-artwork']?.front_default
            }
          }
        },
        types: pokemon.types
      }));
      
      localStorage.setItem('pokedex_offline_data', JSON.stringify(toSave));
      setOfflineData(toSave);
    } catch (error) {
      console.error('Error guardando datos offline:', error);
    }
  };

  // Búsqueda global en la API
  const performGlobalSearch = async (searchTerm) => {
    try {
      setSearchLoading(true);
      
      if (searchTerm.length < 2) {
        const offset = (currentPage - 1) * pokemonsPerPage;
        const endIndex = offset + pokemonsPerPage;
        const pagePokemons = allPokemons.slice(offset, endIndex).filter(pokemon => pokemon);
        setDisplayedPokemons(pagePokemons);
        setSearchLoading(false);
        return;
      }

      // Si estamos offline, buscar en datos locales
      if (!isOnline) {
        const localResults = offlineData.filter(pokemon =>
          pokemon.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setDisplayedPokemons(localResults);
        setSearchLoading(false);
        return;
      }

      // Buscar en la API - limitamos a 1000 resultados para evitar sobrecarga
      const searchResponse = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=1000`);
      const searchData = await searchResponse.json();
      
      // Filtrar variantes de la búsqueda
      const filteredResults = filterVariants(searchData.results);
      
      const matchingPokemon = filteredResults.filter(pokemon =>
        pokemon.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const pokemonDetailsPromises = matchingPokemon
        .slice(0, 50)
        .map(async (pokemon) => {
          try {
            const res = await fetch(pokemon.url);
            if (!res.ok) throw new Error(`Error en Pokémon ${pokemon.name}`);
            return await res.json();
          } catch (error) {
            console.error(`Error cargando Pokémon ${pokemon.name}:`, error);
            return null;
          }
        });

      const pokemonDetails = (await Promise.all(pokemonDetailsPromises))
        .filter(pokemon => pokemon !== null);

      setDisplayedPokemons(pokemonDetails);
      setSearchLoading(false);
      
    } catch (error) {
      console.error('Error en búsqueda global:', error);
      // Fallback a búsqueda local
      const localResults = allPokemons
        .filter(pokemon => pokemon && pokemon.name)
        .filter(pokemon =>
          pokemon.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      setDisplayedPokemons(localResults);
      setSearchLoading(false);
    }
  };

  const fetchPokemons = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (currentPage - 1) * pokemonsPerPage;
      
      // Si estamos offline, usar datos cacheados
      if (!isOnline && offlineData.length > 0) {
        const offset = (currentPage - 1) * pokemonsPerPage;
        const endIndex = offset + pokemonsPerPage;
        const offlinePageData = offlineData.slice(offset, endIndex);
        setDisplayedPokemons(offlinePageData);
        setLoading(false);
        return;
      }
      
      const response = await fetch(
        `https://pokeapi.co/api/v2/pokemon?limit=${pokemonsPerPage}&offset=${offset}`
      );
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filtrar variantes antes de obtener detalles
      const filteredResults = filterVariants(data.results);
      
      const pokemonDetailsPromises = filteredResults.map(async (pokemon, index) => {
        try {
          const res = await fetch(pokemon.url);
          if (!res.ok) throw new Error(`Error en Pokémon ${pokemon.name}`);
          const pokemonData = await res.json();
          return pokemonData;
        } catch (error) {
          console.error(`Error cargando Pokémon ${pokemon.name}:`, error);
          return null;
        }
      });
      
      const pokemonDetails = (await Promise.all(pokemonDetailsPromises))
        .filter(pokemon => pokemon !== null);

      // Guardar en almacenamiento offline
      saveToOfflineStorage(pokemonDetails);

      setAllPokemons(prev => {
        const newPokemons = [...prev];
        pokemonDetails.forEach((detail, index) => {
          if (detail) {
            const globalIndex = offset + index;
            newPokemons[globalIndex] = detail;
          }
        });
        return newPokemons;
      });
      
      setDisplayedPokemons(pokemonDetails.filter(pokemon => pokemon));
      setTotalPages(Math.ceil(totalPokemons / pokemonsPerPage));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pokemons:', error);
      
      // Si hay error y tenemos datos offline, usarlos
      if (offlineData.length > 0) {
        const offset = (currentPage - 1) * pokemonsPerPage;
        const endIndex = offset + pokemonsPerPage;
        const offlinePageData = offlineData.slice(offset, endIndex);
        setDisplayedPokemons(offlinePageData);
        setError('Modo offline: Mostrando datos cacheados');
      } else {
        setError('Error al cargar los Pokémon. Intenta nuevamente.');
      }
      setLoading(false);
    }
  };

  // Función segura para obtener el nombre del Pokémon
  const getPokemonName = (pokemon) => {
    return pokemon?.name || 'Desconocido';
  };

  // Función segura para obtener el ID del Pokémon
  const getPokemonId = (pokemon) => {
    return pokemon?.id ? `#${pokemon.id.toString().padStart(3, '0')}` : '#???';
  };

  // Función segura para obtener la imagen del Pokémon
  const getPokemonImage = (pokemon) => {
    return pokemon?.sprites?.other?.['official-artwork']?.front_default || 
           pokemon?.sprites?.front_default || 
           'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02MCAzMEM2NSA0NSA3NSA2MCA2MCA3MEM0NSA2MCA1NSA0NSA2MCAzMFoiIGZpbGw9IiNEOEUyRTkiLz4KPHN2Zz4K';
  };

  // Función segura para obtener los tipos del Pokémon
  const getPokemonTypes = (pokemon) => {
    return pokemon?.types || [];
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToLastPage = () => {
    setCurrentPage(totalPages);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calcular qué páginas mostrar en la paginación
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  const retryFetch = () => {
    setError(null);
    fetchPokemons();
  };

  const clearSearch = () => {
    setSearch('');
    setCurrentPage(1);
  };

  if (error && displayedPokemons.length === 0) {
    return (
      <div className="App">
        <div className="error-container">
          <h2>¡Ups! Algo salió mal</h2>
          <p>{error}</p>
          <button onClick={retryFetch} className="retry-btn">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (loading && displayedPokemons.length === 0) {
    return (
      <div className="App">
        <div className="loading">Cargando Pokémon...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-top">
          <h1>PokéPWA</h1>
          <div className="header-info">
            <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? '🟢 En línea' : '🔴 Offline'}
            </div>
            <div className="pokemon-count">
              {totalPokemons} Pokémon 
            </div>
          </div>
        </div>
        
        {!isOnline && (
          <div className="offline-message">
            Modo offline activado - Mostrando datos cacheados
          </div>
        )}

        <div className="search-container">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Buscar Pokémon por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button onClick={clearSearch} className="clear-search-btn">
                ×
              </button>
            )}
          </div>
          {searchLoading && (
            <div className="search-loading">Buscando...</div>
          )}
        </div>
        
        {search && !searchLoading && (
          <div className="search-info">
            {displayedPokemons.length} Pokémon encontrado(s) para "{search}"
            <button onClick={clearSearch} className="clear-results-btn">
              Limpiar búsqueda
            </button>
          </div>
        )}
      </header>

      <div className="pokemon-grid">
        {displayedPokemons.map((pokemon) => (
          <div key={pokemon.id} className="pokemon-card">
            <img
              src={getPokemonImage(pokemon)}
              alt={getPokemonName(pokemon)}
              className="pokemon-image"
              onError={(e) => {
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02MCAzMEM2NSA0NSA3NSA2MCA2MCA3MEM0NSA2MCA1NSA0NSA2MCAzMFoiIGZpbGw9IiNEOUUyRTkiLz4KPHN2Zz4K';
              }}
            />
            <h3 className="pokemon-name">
              {getPokemonName(pokemon).charAt(0).toUpperCase() + getPokemonName(pokemon).slice(1)}
            </h3>
            <p className="pokemon-id">{getPokemonId(pokemon)}</p>
            <div className="pokemon-types">
              {getPokemonTypes(pokemon).map((typeInfo) => (
                <span key={typeInfo.type.name} className={`type ${typeInfo.type.name}`}>
                  {typeInfo.type.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {displayedPokemons.length === 0 && !loading && !searchLoading && search && (
        <div className="no-results">
          <p>No se encontraron Pokémon que coincidan con "{search}"</p>
          <p className="search-tip">
            💡 Tip: Solo se muestran Pokémon base (sin variantes)
          </p>
          <button onClick={clearSearch} className="clear-results-btn">
            Ver todos los Pokémon
          </button>
        </div>
      )}

      {/* Paginación - solo mostrar cuando no hay búsqueda activa */}
      {!search && (
        <>
          <div className="pagination">
            <button 
              onClick={prevPage} 
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Anterior
            </button>
            
            {currentPage > 3 && (
              <>
                <button 
                  onClick={() => goToPage(1)}
                  className="pagination-btn"
                >
                  1
                </button>
                {currentPage > 4 && <span className="pagination-ellipsis">...</span>}
              </>
            )}
            
            {getPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
              >
                {page}
              </button>
            ))}
            
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="pagination-ellipsis">...</span>}
                <button 
                  onClick={() => goToPage(totalPages)}
                  className="pagination-btn"
                >
                  {totalPages}
                </button>
              </>
            )}
            
            {/* <button 
              onClick={goToLastPage}
              disabled={currentPage === totalPages}
              className="pagination-btn last-page-btn"
            >
              Última
            </button> */}
            
            <button 
              onClick={nextPage} 
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Siguiente
            </button>
          </div>

          <div className="page-info">
            Página {currentPage} de {totalPages} • {totalPokemons} Pokémon 
            {!isOnline && <div className="cache-info">Modo offline - Datos cacheados</div>}
          </div>
        </>
      )}

      {loading && displayedPokemons.length > 0 && (
        <div className="loading-more">Cargando más Pokémon...</div>
      )}
    </div>
  );
}

export default App;