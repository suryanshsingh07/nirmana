import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const LOCAL_TASKS_PREFIX = 'actify_tasks_';

const initialDemoTasks = [
  {
    id: 'demo_task_1',
    name: 'CS301 Milestone 2 Report',
    subject: 'CS301 Algorithm Analysis',
    type: 'assignment',
    deadline: '2026-10-09T23:59',
    priority: 'high',
    difficulty: 'hard',
    estimatedHours: 6,
    completedHours: 2,
    status: 'pending',
    notes: 'Upload report to portal by next Friday 11:59 PM',
  },
  {
    id: 'demo_task_2',
    name: 'CS304 Database Schema Doc',
    subject: 'Database Systems (CS304)',
    type: 'project',
    deadline: '2026-10-15T23:59',
    priority: 'high',
    difficulty: 'medium',
    estimatedHours: 8,
    completedHours: 3,
    status: 'pending',
    notes: 'Mini-project schema documentation due Oct 15th before midnight',
  },
  {
    id: 'demo_task_3',
    name: 'Web Lab Exercise 4',
    subject: 'Web Architecture Lab',
    type: 'lab',
    deadline: '2026-10-16T17:00',
    priority: 'high',
    difficulty: 'medium',
    estimatedHours: 4,
    completedHours: 1,
    status: 'pending',
    notes: 'Exercise 4 submission portal closes Oct 16 at 5:00 PM',
  },
  {
    id: 'demo_task_4',
    name: 'ENG202 Literature Review Draft',
    subject: 'Technical Writing (ENG202)',
    type: 'essay',
    deadline: '2026-10-16T23:59',
    priority: 'high',
    difficulty: 'hard',
    estimatedHours: 7,
    completedHours: 0,
    status: 'pending',
    notes: 'Draft literature review is due on Oct 16th by 23:59',
  },
  {
    id: 'demo_task_5',
    name: 'CS308 Packet Tracer Analysis',
    subject: 'Computer Networks (CS308)',
    type: 'homework',
    deadline: '2026-10-24T23:59',
    priority: 'medium',
    difficulty: 'medium',
    estimatedHours: 5,
    completedHours: 0,
    status: 'pending',
    notes: 'Packet tracer analysis assignment due on 24th Oct',
  },
  {
    id: 'demo_task_6',
    name: 'MATH201 Problem Set 5',
    subject: 'Calculus III (MATH201)',
    type: 'homework',
    deadline: '2026-11-04T09:00',
    priority: 'medium',
    difficulty: 'hard',
    estimatedHours: 4,
    completedHours: 0,
    status: 'pending',
    notes: 'Problem set 5 due on 11/04 in class',
  },
];

function getLocalTasks(uid) {
  try {
    const raw = localStorage.getItem(`${LOCAL_TASKS_PREFIX}${uid}`);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(`${LOCAL_TASKS_PREFIX}${uid}`, JSON.stringify(initialDemoTasks));
    return initialDemoTasks;
  } catch {
    return initialDemoTasks;
  }
}

function saveLocalTasks(uid, tasks) {
  try {
    localStorage.setItem(`${LOCAL_TASKS_PREFIX}${uid}`, JSON.stringify(tasks));
  } catch (err) {
    console.warn('Could not save local tasks:', err);
  }
}

function tasksRef(uid) {
  return collection(db, 'users', uid, 'tasks');
}

export async function addTask(uid, taskData) {
  if (isFirebaseConfigured && db) {
    try {
      return await addDoc(tasksRef(uid), {
        ...taskData,
        completedHours: 0,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore addTask failed, using local storage fallback:', err.message);
    }
  }

  const tasks = getLocalTasks(uid);
  const newTask = {
    ...taskData,
    id: 'task_' + Date.now(),
    completedHours: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  saveLocalTasks(uid, tasks);
  return { id: newTask.id };
}

export async function updateTask(uid, taskId, updates) {
  if (isFirebaseConfigured && db) {
    try {
      const taskDoc = doc(db, 'users', uid, 'tasks', taskId);
      return await updateDoc(taskDoc, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore updateTask failed, using local storage fallback:', err.message);
    }
  }

  const tasks = getLocalTasks(uid);
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    saveLocalTasks(uid, tasks);
  }
  return Promise.resolve();
}

export async function deleteTask(uid, taskId) {
  if (isFirebaseConfigured && db) {
    try {
      const taskDoc = doc(db, 'users', uid, 'tasks', taskId);
      return await deleteDoc(taskDoc);
    } catch (err) {
      console.warn('Firestore deleteTask failed, using local storage fallback:', err.message);
    }
  }

  const tasks = getLocalTasks(uid);
  const filtered = tasks.filter((t) => t.id !== taskId);
  saveLocalTasks(uid, filtered);
  return Promise.resolve();
}

export async function getUserTasks(uid) {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(tasksRef(uid), orderBy('deadline', 'asc'));
      return await getDocs(q);
    } catch (err) {
      console.warn('Firestore getUserTasks failed, using local storage fallback:', err.message);
    }
  }

  const tasks = getLocalTasks(uid);
  tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  return {
    docs: tasks.map((task) => ({
      id: task.id,
      data: () => task,
    })),
  };
}

export async function completeTask(uid, taskId) {
  if (isFirebaseConfigured && db) {
    try {
      const taskDoc = doc(db, 'users', uid, 'tasks', taskId);
      return await updateDoc(taskDoc, {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore completeTask failed, using local storage fallback:', err.message);
    }
  }

  const tasks = getLocalTasks(uid);
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx], status: 'completed', updatedAt: new Date().toISOString() };
    saveLocalTasks(uid, tasks);
  }
  return Promise.resolve();
}

export async function logTaskProgress(uid, task, hours) {
  const newCompletedHours = (task.completedHours || 0) + hours;
  const isNowComplete = newCompletedHours >= (task.estimatedHours || 0);

  if (isFirebaseConfigured && db) {
    try {
      const taskDoc = doc(db, 'users', uid, 'tasks', task.id);
      return await updateDoc(taskDoc, {
        completedHours: newCompletedHours,
        status: isNowComplete ? 'completed' : 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore logTaskProgress failed, using local storage fallback:', err.message);
    }
  }

  const tasks = getLocalTasks(uid);
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx !== -1) {
    tasks[idx] = {
      ...tasks[idx],
      completedHours: newCompletedHours,
      status: isNowComplete ? 'completed' : 'pending',
      updatedAt: new Date().toISOString(),
    };
    saveLocalTasks(uid, tasks);
  }
  return Promise.resolve();
}

export async function clearCompletedTasks(uid, taskIds) {
  const promises = taskIds.map((id) => deleteTask(uid, id));
  await Promise.all(promises);
}
