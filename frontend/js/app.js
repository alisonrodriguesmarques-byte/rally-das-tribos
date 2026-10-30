/**
 * Rally das Tribos - JavaScript Principal
 * Frontend Application
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏆 Rally das Tribos - Frontend carregado');

    // Testar conexão com a API
    testAPIConnection();
});

async function testAPIConnection() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.status === 'ok') {
            console.log('✅ API conectada com sucesso');
            console.log('📡 Timestamp:', data.timestamp);
        }
    } catch (error) {
        console.error('❌ Erro ao conectar com API:', error);
    }
}
