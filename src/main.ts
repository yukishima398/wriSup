import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

//メソッドチェーン
// アプリのインスタンスを作って、ルーターを middleware のように登録してから、HTMLに反映させる
createApp(App).
    use(router).// これでコンポーネント内で $route や $router が使えるようになる
        mount('#app')// index.html にある <div id="app"> にアプリをマウント

// 全データがIndexedDBのみに保存されるアプリのため、ブラウザに「消さないで」と明示的に要求する
// (ストレージ逼迫時の自動削除リスクを下げる。iOSのSafariでは7日ルールを完全には防げない)
navigator.storage?.persist?.()
