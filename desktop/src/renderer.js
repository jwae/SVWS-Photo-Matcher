import { createApp } from 'vue'
import App from './App.vue'

// falls du Bootstrap & Icons wie in deinem main.js nutzt:
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// deine App-Styles (wenn du App.css als globale CSS nutzen willst)
import './App.css'

createApp(App).mount('#app')
