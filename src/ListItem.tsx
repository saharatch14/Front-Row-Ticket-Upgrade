import './ListItem.css';
import { useEffect, useState } from 'react';

interface ListItemProps {
  taskName: string;
  removeTask: (taskName: string) => void;
};

function ListItem({ taskName, removeTask }: ListItemProps) {

  const [num, setNum] = useState(0)
  const [num2, setNum2] = useState(0)

  useEffect(() => {
    console.log("Mount")

    return () => {
      console.log('Unmount')
    }
  }, [])

  useEffect(() => {
    console.log("Update")
  })

  useEffect(() => {
    console.log("Update 1")
  }, [num])

  useEffect(() => {
    console.log("Update 2")
  }, [num2])

  function doSomething() {
    setNum(num +1)
  }

    function doSomething2() {
    setNum2(num2 +1)
  }

  return (
    <div className="list-item">
      <span className="task-text">{taskName}</span>
      <span className="task-text">{num}</span>
      <button className="action-btn" onClick={() => removeTask(taskName)}>Delete</button>
      <button className="action-btn">Edit</button>
      <button className="action-btn" onClick={() => doSomething()}>Test</button>
      <button className="action-btn" onClick={() => doSomething2()}>Test2</button>
    </div>
  );
}

export default ListItem;