import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

//メソッドチェーン
// アプリのインスタンスを作って、ルーターを middleware のように登録してから、HTMLに反映させる
createApp(App).
    use(router).// これでコンポーネント内で $route や $router が使えるようになる
        mount('#app')// index.html にある <div id="app"> にアプリをマウント
