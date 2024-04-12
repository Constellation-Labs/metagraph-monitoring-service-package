import ISshService from '@interfaces/services/ssh/ISshService';

export default async (
  sshService: ISshService,
  startingOrdinal: number,
  endingOrdinal: number,
): Promise<void> => {
  await sshService.executeCommand(
    `
      cd metagraph-l0
      source_dir=data/incremental_snapshot
      for i in $(seq ${startingOrdinal} ${endingOrdinal}); do
          source_file="$source_dir/$i"
          if [ -e "$source_file" ]; then
              echo "Processing file with ID $source_file"
              sudo rm "$source_file"
          else
              echo "File $source_file does not exist."
          fi
      done
    `,
  );
  return;
};
