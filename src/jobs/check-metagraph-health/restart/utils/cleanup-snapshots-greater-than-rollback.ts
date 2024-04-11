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
      # Use find to locate the files within the specified range
      for i in $(seq ${startingOrdinal} ${endingOrdinal}); do
        source_file=$source_dir/$i
      
        # Check if the source file exists before attempting to remove it
        if [ -e $source_file ]; then
            echo Processing file with ID $source_file
            find $source_dir -mount -samefile $source_file -exec sudo rm {} \\;
        else
            echo File $source_file does not exist.
        fi
      done
      
    `,
  );
  return;
};
