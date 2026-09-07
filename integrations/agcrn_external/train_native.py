import os, sys, runpy, torch
from pathlib import Path
torch.set_num_threads(2)
root = Path(__file__).resolve().parents[2] / 'third_party' / 'AGCRN'
os.chdir(root / 'model')
sys.path.insert(0, str(root))
sys.argv = ['Run.py', '--dataset', 'PEMSD8', '--num_nodes', '170', '--mode', 'train', '--device', 'cpu', '--debug', 'False', '--epochs', '1', '--lag', '3', '--horizon', '3', '--rnn_units', '8', '--num_layers', '1', '--embed_dim', '4', '--cheb_k', '2', '--real_value', 'False', '--batch_size', '64', '--log_step', '40', '--seed', '10']
print('Native AGCRN Run.py arguments:', sys.argv, flush=True)
runpy.run_path(str(root / 'model' / 'Run.py'), run_name='__main__')
