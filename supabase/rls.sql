-- ============================================================
-- Row Level Security (RLS) для Work Hours Tracker
-- Применить: Supabase Dashboard → SQL Editor → выполнить всё
-- ============================================================

-- ======== profiles ========
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Каждый видит только свой профиль; admin видит все
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Обновлять можно только свой профиль
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Вставка при регистрации (trigger создаёт запись, но на всякий случай)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ======== work_shifts ========
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои смены; admin видит все
CREATE POLICY "shifts_select" ON work_shifts FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Пользователь может вставлять только под своим user_id
CREATE POLICY "shifts_insert" ON work_shifts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Пользователь обновляет только свои; admin обновляет любые
CREATE POLICY "shifts_update" ON work_shifts FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Пользователь удаляет только свои; admin удаляет любые
CREATE POLICY "shifts_delete" ON work_shifts FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );


-- ======== planned_shifts ========
ALTER TABLE planned_shifts ENABLE ROW LEVEL SECURITY;

-- Члены группы читают плановые смены своей группы; admin видит всё
CREATE POLICY "planned_select" ON planned_shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_groups ug
      JOIN groups g ON g.id = ug.group_id
      WHERE ug.user_id = auth.uid() AND g.name = planned_shifts.group_name
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Только editor в группе или admin может создавать/изменять/удалять
CREATE POLICY "planned_write" ON planned_shifts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_groups ug
      JOIN groups g ON g.id = ug.group_id
      WHERE ug.user_id = auth.uid()
        AND g.name = planned_shifts.group_name
        AND (
          ug.role = 'editor'
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );


-- ======== schedule_notes (создать таблицу если не существует) ========
CREATE TABLE IF NOT EXISTS schedule_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date        date NOT NULL,
  text        text NOT NULL,
  author      text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE schedule_notes ENABLE ROW LEVEL SECURITY;

-- Члены группы читают заметки своей группы
CREATE POLICY "notes_select" ON schedule_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_groups ug
      WHERE ug.user_id = auth.uid() AND ug.group_id = schedule_notes.group_id
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Только editor или admin пишет/удаляет заметки
CREATE POLICY "notes_write" ON schedule_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_groups ug
      WHERE ug.user_id = auth.uid()
        AND ug.group_id = schedule_notes.group_id
        AND (
          ug.role = 'editor'
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );


-- ======== user_groups ========
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свои группы; admin видит все
CREATE POLICY "user_groups_select" ON user_groups FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Только admin может добавлять/изменять/удалять связи user_groups
CREATE POLICY "user_groups_admin_write" ON user_groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );


-- ======== groups ========
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Все авторизованные пользователи читают группы (нужно для dropdownов)
CREATE POLICY "groups_select" ON groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Только admin создаёт/изменяет/удаляет группы
CREATE POLICY "groups_admin_write" ON groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
