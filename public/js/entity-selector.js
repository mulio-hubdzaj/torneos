(function () {
  const FAVORITE_KEY = 'torneos_entidad_favorita';

  function normalizar(valor) {
    return String(valor || '').trim();
  }

  function etiquetaEntidad(entidad) {
    const descripcion = normalizar(entidad.descripcion);
    const codigo = normalizar(entidad.codigo);
    if (descripcion && codigo) return `${descripcion} (${codigo})`;
    return descripcion || codigo || 'Entidad';
  }

  function leerFavorita() {
    try {
      const raw = localStorage.getItem(FAVORITE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function guardarFavorita(entidad) {
    localStorage.setItem(FAVORITE_KEY, JSON.stringify({
      entity_id: entidad.entity_id,
      codigo: entidad.codigo,
      descripcion: entidad.descripcion
    }));
  }

  function guardarFavoritaVacia() {
    localStorage.setItem(FAVORITE_KEY, JSON.stringify({
      empty: true,
      entity_id: '',
      codigo: '',
      descripcion: 'Sin entidad'
    }));
  }

  function esFavoritaVacia(entidad) {
    return Boolean(entidad && entidad.empty);
  }

  function mismaEntidad(a, b) {
    if (esFavoritaVacia(a) || esFavoritaVacia(b)) {
      return esFavoritaVacia(a) && esFavoritaVacia(b);
    }
    if (!a || !b) return false;
    return String(a.entity_id || '') === String(b.entity_id || '') ||
      String(a.codigo || '').toUpperCase() === String(b.codigo || '').toUpperCase();
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function crearSelector(root) {
    const input = root.querySelector('.entity-selector-input');
    const hidden = root.querySelector('.entity-selector-value');
    const results = root.querySelector('.entity-selector-results');
    const favoriteButton = root.querySelector('.entity-selector-favorite');
    const valueField = root.dataset.valueField || 'codigo';
    const required = root.dataset.required === 'true';
    const allowEmptyFavorite = root.dataset.allowEmptyFavorite === 'true';
    let seleccionActual = null;
    let resultadosActuales = [];

    if (!input || !hidden || !results || !favoriteButton) return;

    function actualizarEstrella() {
      const favorita = leerFavorita();
      const seleccionVacia = !seleccionActual && !hidden.value && !input.value.trim();
      const activa = mismaEntidad(seleccionActual, favorita) || (allowEmptyFavorite && seleccionVacia && esFavoritaVacia(favorita));
      favoriteButton.classList.toggle('is-active', activa);
      favoriteButton.setAttribute('aria-pressed', activa ? 'true' : 'false');
      favoriteButton.title = activa ? 'Entidad favorita activa' : 'Marcar como entidad favorita';
      const icon = favoriteButton.querySelector('i');
      if (icon) icon.className = activa ? 'bi bi-star-fill' : 'bi bi-star';
    }

    function valorEntidad(entidad) {
      return valueField === 'entity_id' ? entidad.entity_id : entidad.codigo;
    }

    function seleccionar(entidad, opciones = {}) {
      if (esFavoritaVacia(entidad)) {
        limpiarSeleccion();
        return;
      }

      seleccionActual = entidad;
      input.value = etiquetaEntidad(entidad);
      hidden.value = valorEntidad(entidad) || '';
      root.classList.remove('entity-selector-invalid');
      results.classList.add('d-none');
      actualizarEstrella();

      if (opciones.guardarFavorita) {
        guardarFavorita(entidad);
        actualizarEstrella();
      }

      if (root.dataset.saveOnSelect === 'true') {
        guardarFavorita(entidad);
        actualizarEstrella();
      }

      root.dispatchEvent(new CustomEvent('entity:selected', { detail: entidad }));
    }

    function limpiarSeleccion(opciones = {}) {
      seleccionActual = null;
      input.value = '';
      hidden.value = '';
      root.classList.remove('entity-selector-invalid');
      results.classList.add('d-none');

      if (opciones.guardarFavorita && allowEmptyFavorite) {
        guardarFavoritaVacia();
      }

      actualizarEstrella();
      root.dispatchEvent(new CustomEvent('entity:selected', { detail: null }));
    }

    function renderResultados(entidades) {
      resultadosActuales = entidades;
      if (!entidades.length) {
        results.innerHTML = '<div class="entity-selector-empty">Sin coincidencias</div>';
        results.classList.remove('d-none');
        return;
      }

      const favorita = leerFavorita();
      results.innerHTML = entidades.map((entidad, index) => {
        const esFavorita = mismaEntidad(entidad, favorita);
        return `
          <button type="button" class="entity-selector-option" data-index="${index}">
            <span>
              <strong>${escapeHtml(entidad.descripcion || entidad.codigo || 'Entidad')}</strong>
              <small>${escapeHtml(entidad.codigo || '')}</small>
            </span>
            ${esFavorita ? '<i class="bi bi-star-fill"></i>' : ''}
          </button>
        `;
      }).join('');
      results.classList.remove('d-none');
    }

    async function buscar(q) {
      try {
        const response = await fetch(`/entidades/buscar?q=${encodeURIComponent(q || '')}`, {
          headers: { Accept: 'application/json' }
        });
        const data = await response.json();
        renderResultados(data.entidades || []);
      } catch (error) {
        console.error(error);
        renderResultados([]);
      }
    }

    const buscarDebounced = debounce(buscar, 220);

    input.addEventListener('input', () => {
      seleccionActual = null;
      hidden.value = '';
      actualizarEstrella();
      buscarDebounced(input.value);
    });

    input.addEventListener('focus', () => {
      buscar(input.value);
    });

    results.addEventListener('click', event => {
      const option = event.target.closest('.entity-selector-option');
      if (!option) return;
      const entidad = resultadosActuales[Number(option.dataset.index)];
      if (entidad) seleccionar(entidad);
    });

    favoriteButton.addEventListener('click', () => {
      if (!seleccionActual) {
        if (allowEmptyFavorite && !input.value.trim() && !hidden.value) {
          guardarFavoritaVacia();
          actualizarEstrella();
          return;
        }

        const favorita = leerFavorita();
        if (favorita) seleccionar(favorita);
        return;
      }
      guardarFavorita(seleccionActual);
      actualizarEstrella();
    });

    document.addEventListener('click', event => {
      if (!root.contains(event.target)) results.classList.add('d-none');
    });

    const favorita = leerFavorita();
    if (favorita && root.dataset.useFavorite !== 'false') {
      if (esFavoritaVacia(favorita) && allowEmptyFavorite) {
        limpiarSeleccion();
      } else if (!esFavoritaVacia(favorita)) {
        seleccionar(favorita);
      } else {
        actualizarEstrella();
      }
    } else {
      actualizarEstrella();
    }

    root.closest('form')?.addEventListener('submit', event => {
      if (hidden.value && seleccionActual && root.dataset.saveOnSubmit === 'true') {
        guardarFavorita(seleccionActual);
        actualizarEstrella();
      } else if (!hidden.value && allowEmptyFavorite && root.dataset.saveOnSubmit === 'true' && !input.value.trim()) {
        guardarFavoritaVacia();
        actualizarEstrella();
      }

      if (!required || hidden.value) return;
      event.preventDefault();
      input.focus();
      root.classList.add('entity-selector-invalid');
    });
  }

  function escapeHtml(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-entity-selector]').forEach(crearSelector);
  });
})();
