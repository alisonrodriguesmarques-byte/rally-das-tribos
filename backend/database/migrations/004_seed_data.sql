-- Migration 004: Dados iniciais (Seed Data)
-- Rally das Tribos - Categorias globais de pontos

-- Inserir categorias globais de pontos (rally_id = NULL)
INSERT INTO categorias_pontos (nome, descricao, cor) VALUES
('Quiz', 'Provas de múltipla escolha e quizzes', '#3B82F6'),
('Complete o Versículo', 'Provas de completar versículos bíblicos', '#10B981'),
('Verdadeiro ou Falso', 'Provas de verdadeiro ou falso', '#F59E0B'),
('Dinâmicas', 'Dinâmicas presenciais realizadas pelas tribos', '#8B5CF6'),
('Missões', 'Missões semanais e especiais', '#EF4444'),
('Evangelização', 'Pontos por almas novas e convidados', '#EC4899'),
('Presença', 'Pontos por presença nos encontros', '#6366F1'),
('Organização', 'Pontos por organização do espaço', '#14B8A6'),
('Outros', 'Outras categorias de pontuação', '#6B7280');
